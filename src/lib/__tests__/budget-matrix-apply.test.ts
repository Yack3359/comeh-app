import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { matrixAction, parsedMatrix } from "./budget-fixtures";

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(), auditLog: { create: vi.fn() },
  fiscalYear: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  budgetPost: { findMany: vi.fn(), upsert: vi.fn() },
  budgetAction: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  season: { findMany: vi.fn() }, budgetSnapshot: { create: vi.fn(), findFirst: vi.fn() },
}));
const transaction = vi.hoisted(() => vi.fn());
const auditLogCreate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction, auditLog: { create: auditLogCreate } } }));
import { applyBudgetMatrix, inferredSeasonLabel, MatrixChronologyError } from "../budget-matrix-apply";
import { getAuditContext, runWithAuditContext } from "../audit-context";
import { matrixActionValues } from "../budget-matrix-diff";

const decimal = (value: number) => new Prisma.Decimal(value);
const existing = () => ({
  id: "old", postId: "post-b", label: "Stage Laupheim M20 avril", matrixKey: "avril laupheim m20 stage",
  matrixLineNumber: null, matrixOccurrence: null,
  status: "CANCELLED", settled: false, includedInBudget: true, proposedSaving: false, origin: "RENEWED",
  initialGross: decimal(6000), initialClubIncome: decimal(1000), initialFederation: decimal(5000),
  revisedGross: decimal(5000), revisedClubIncome: decimal(1000), revisedFederation: decimal(4000),
  adjustmentFederation: decimal(0), adjustmentReason: null,
  actualGross: null, actualClubIncome: null, actualFederation: null, estimatedFederation: decimal(1200),
  previousYearAmount: decimal(3500), revisionReason: "Décision manuelle", notes: null, comment: "Décision de la commission",
  fencingCategories: ["U23"], plannedMonth: 10, seasonId: "manual-season", competitionId: "manual-competition",
  sortOrder: 0, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
  post: { id: "post-b", code: "B", label: "Stages M20-M17", kind: "TRAINING_CAMP" },
});
const params = () => ({ parsed: parsedMatrix(), fiscalYearId: "fy", asOfDate: "2026-09-08", userId: "user", fileName: "matrice.xlsx", fileUrl: "budget-matrices/file.xlsx" });

describe("matrix application", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db));
    db.fiscalYear.findUniqueOrThrow.mockResolvedValue({ id: "fy", label: "2026", restitutionAmount: decimal(500) });
    db.budgetPost.findMany.mockResolvedValue([existing().post]);
    db.budgetPost.upsert.mockResolvedValue({ id: "post-b" });
    db.season.findMany.mockResolvedValue([{ id: "season-spring", label: "25/26" }, { id: "season-autumn", label: "26/27" }]);
    db.budgetSnapshot.create.mockResolvedValue({ id: "snapshot" });
    db.budgetAction.findMany.mockResolvedValue([existing()]);
  });
  it("preserves initial/manual fields and CANCELLED, and stores numeric post-import summary", async () => {
    const after = { ...existing(), revisedFederation: decimal(4500) };
    db.budgetAction.findMany.mockResolvedValueOnce([existing()]).mockResolvedValueOnce([after]);
    const input = params();
    input.parsed.actions[0].federation = 4500;
    const result = await applyBudgetMatrix(input);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 20000, timeout: 100000 });
    const data = db.budgetAction.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "CANCELLED", revisedFederation: 4500, matrixLineNumber: 1, matrixOccurrence: 0, fencingCategories: ["U23"], plannedMonth: 10, seasonId: "manual-season" });
    for (const field of ["initialGross", "initialClubIncome", "initialFederation", "estimatedFederation", "revisionReason", "competitionId", "settled", "comment"]) expect(data).not.toHaveProperty(field);
    const snapshot = db.budgetSnapshot.create.mock.calls[0][0].data;
    expect(snapshot).toMatchObject({ importedById: "user", sourceFileName: "matrice.xlsx", fileUrl: "budget-matrices/file.xlsx", data: { totals: { budget: 4500 }, restitution: 500 } });
    expect(snapshot.data.actions[0]).toMatchObject({ revisedFederation: 4500, initialFederation: 5000, estimatedFederation: 1200 });
    expect(snapshot.asOfDate.toISOString()).toBe("2026-09-08T00:00:00.000Z");
    expect(result).toEqual({ snapshotId: "snapshot", created: 0, updated: 1, unchanged: 0, missing: 0 });
  });
  it("replaces matrix notes on repeated imports without writing commission comments", async () => {
    const action = existing();
    db.budgetAction.findMany.mockImplementation(async () => [action]);
    db.budgetAction.update.mockImplementation(async ({ data }) => Object.assign(action, data));
    for (const notes of ["Note de la matrice", "Note actualisée", null]) {
      const input = params();
      input.parsed.actions[0].notes = notes;
      expect(matrixActionValues(input.parsed.actions[0])).not.toHaveProperty("comment");
      await applyBudgetMatrix(input);
      expect(db.budgetAction.update.mock.lastCall?.[0].data).not.toHaveProperty("comment");
      expect(action.notes).toBe(notes);
      expect(action.comment).toBe("Décision de la commission");
      expect(db.budgetSnapshot.create.mock.lastCall?.[0].data.data.actions[0]).toMatchObject({
        notes, comment: "Décision de la commission",
      });
    }
  });
  it("creates initial amounts and infers season, but does not delete missing actions", async () => {
    const input = params();
    input.parsed = parsedMatrix([matrixAction({ label: "Autre action", matrixKey: "action autre" })]);
    const result = await applyBudgetMatrix(input);
    expect(db.budgetAction.create.mock.calls[0][0].data).toMatchObject({
      initialGross: 5000, initialClubIncome: 1000, initialFederation: 4000,
      revisedGross: 5000, revisedClubIncome: 1000, revisedFederation: 4000,
      matrixLineNumber: 1, matrixOccurrence: 0, seasonId: "season-spring", fencingCategories: ["M20"], plannedMonth: 4, status: "BUDGETED",
    });
    expect(db.budgetAction.create.mock.calls[0][0].data).not.toHaveProperty("comment");
    expect(result).toMatchObject({ created: 1, missing: 1 });
    expect(db.auditLog.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({
      action: "IMPORT_MATRIX", entityType: "BudgetSnapshot", userId: "user",
      diffJson: expect.objectContaining({ created: 1, missing: 1 }),
    }) });
  });
  it("fills empty inferred fields and lets actuals replace a manual status with DONE", async () => {
    db.budgetAction.findMany.mockResolvedValue([{ ...existing(), fencingCategories: [], plannedMonth: null, seasonId: null }]);
    const input = params();
    input.parsed.actions[0] = matrixAction({ suggestedStatus: "DONE", actualFederation: 20 });
    await applyBudgetMatrix(input);
    expect(db.budgetAction.update.mock.calls[0][0].data).toMatchObject({ status: "DONE", fencingCategories: ["M20"], plannedMonth: 4, seasonId: "season-spring" });
  });
  it("leaves season null if absent and rejects invalid overrides before any mutation", async () => {
    db.season.findMany.mockResolvedValue([]);
    db.budgetAction.findMany.mockResolvedValue([]);
    await applyBudgetMatrix(params());
    expect(db.budgetAction.create.mock.calls[0][0].data.seasonId).toBeNull();
    db.budgetPost.upsert.mockClear();
    await expect(applyBudgetMatrix({ ...params(), overrides: { 8: "foreign-action" } })).rejects.toThrow("Rapprochement invalide");
    expect(db.budgetPost.upsert).not.toHaveBeenCalled();
  });
  it("creates unbudgeted estimates and stores positions", async () => {
    db.budgetAction.findMany.mockResolvedValue([]);
    const input = params();
    input.parsed.actions = [matrixAction({ suggestedStatus: "UNBUDGETED", includedInBudget: false,
      lineNumber: null, lineOccurrence: null, gross: 0, clubIncome: 0, federation: 0, estimatedFederation: 27000 })];
    await applyBudgetMatrix(input);
    expect(db.budgetAction.create.mock.calls[0][0].data).toMatchObject({ estimatedFederation: 27000,
      matrixLineNumber: null, matrixOccurrence: null, initialGross: 0, initialClubIncome: 0, initialFederation: 0,
      revisedGross: 0, revisedClubIncome: 0, revisedFederation: 0, status: "UNBUDGETED", includedInBudget: false });
  });
  it.each([null, 0, 1200])("only fills a null existing estimate (%s)", async estimated => {
    db.budgetAction.findMany.mockResolvedValue([{ ...existing(), estimatedFederation: estimated === null ? null : decimal(estimated) }]);
    const input = params();
    input.parsed.actions[0] = matrixAction({ suggestedStatus: "UNBUDGETED", estimatedFederation: 6000 });
    await applyBudgetMatrix(input);
    const data = db.budgetAction.update.mock.calls[0][0].data;
    if (estimated === null) expect(data.estimatedFederation).toBe(6000);
    else expect(data).not.toHaveProperty("estimatedFederation");
  });
  it("updates a position match instead of creating a duplicate", async () => {
    db.budgetAction.findMany.mockResolvedValue([{ ...existing(), matrixLineNumber: 1, matrixOccurrence: 1 }]);
    const input = params();
    input.parsed.actions[0] = matrixAction({ label: "Tokyo Japon", matrixKey: "japon tokyo", lineOccurrence: 1 });
    await applyBudgetMatrix(input);
    expect(db.budgetAction.create).not.toHaveBeenCalled();
    expect(db.budgetAction.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "old" },
      data: expect.objectContaining({ label: "Tokyo Japon", matrixLineNumber: 1, matrixOccurrence: 1 }) }));
  });
  it.each([[0, 5000, true], [500, 5000, false], [0, null, false]] as const)("applies restitution only to an unset year (%s / %s)", async (current, detected, update) => {
    db.fiscalYear.findUniqueOrThrow.mockResolvedValue({ id: "fy", label: "2026", restitutionAmount: decimal(current) });
    db.fiscalYear.update.mockResolvedValue({ id: "fy", label: "2026", restitutionAmount: decimal(detected ?? current) });
    const input = params();
    input.parsed.restitutionAmount = detected;
    await applyBudgetMatrix(input);
    if (update) expect(db.fiscalYear.update).toHaveBeenCalledWith({ where: { id: "fy" }, data: { restitutionAmount: 5000 } });
    else expect(db.fiscalYear.update).not.toHaveBeenCalled();
    expect(db.budgetSnapshot.create.mock.calls[0][0].data.data.restitution).toBe(update ? detected : current);
  });
  it.each([[1, "25/26"], [8, "25/26"], [9, "26/27"], [12, "26/27"], [null, null]] as const)("infers season for month %s", (month: number | null, label: string | null) => {
    expect(inferredSeasonLabel("2026", month)).toBe(label);
  });
  it("waits for the fiscal year lock before reading the latest snapshot or actions", async () => {
    let unlock!: () => void;
    db.$queryRaw.mockReturnValue(new Promise<void>(resolve => { unlock = resolve; }));
    const pending = applyBudgetMatrix(params());
    expect(db.$queryRaw.mock.calls[0][0].join("?")).toBe("SELECT id FROM fiscal_years WHERE id = ? FOR UPDATE");
    expect(db.$queryRaw.mock.calls[0][1]).toBe("fy");
    expect(db.budgetSnapshot.findFirst).not.toHaveBeenCalled();
    expect(db.budgetAction.findMany).not.toHaveBeenCalled();
    unlock();
    await pending;
    expect(db.budgetSnapshot.findFirst).toHaveBeenCalledWith({ where: { fiscalYearId: "fy" }, orderBy: { asOfDate: "desc" }, select: { asOfDate: true } });
  });
  it("rejects an older situation before any mutation and allows the same date", async () => {
    db.budgetSnapshot.findFirst.mockResolvedValue({ asOfDate: new Date("2026-10-25") });
    await expect(applyBudgetMatrix(params())).rejects.toBeInstanceOf(MatrixChronologyError);
    expect(db.budgetPost.upsert).not.toHaveBeenCalled();
    expect(db.budgetAction.update).not.toHaveBeenCalled();
    expect(db.budgetSnapshot.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
    await applyBudgetMatrix({ ...params(), asOfDate: "2026-10-25" });
    expect(db.budgetSnapshot.create).toHaveBeenCalledOnce();
  });
  it("imports an older historical snapshot from the file without changing live actions, posts or restitution", async () => {
    db.budgetSnapshot.findFirst.mockResolvedValue({ asOfDate: new Date("2026-10-25") });
    const input = params();
    input.parsed.restitutionAmount = 100;
    input.parsed.actions[0] = matrixAction({ federation: 2000, actualFederation: 800, suggestedStatus: "DONE" });
    const result = await applyBudgetMatrix({ ...input, historicalOnly: true });
    expect(result).toMatchObject({ historicalOnly: true, created: 0, updated: 0 });
    expect(db.budgetSnapshot.create.mock.calls[0][0].data.data).toMatchObject({
      restitution: 100, totals: { budget: 2000, actual: 800, remaining: 0, landing: 800 },
      actions: [expect.objectContaining({ revisedFederation: 2000, actualFederation: 800, settled: null })],
    });
    expect(db.budgetAction.findMany).not.toHaveBeenCalled();
    expect(db.budgetAction.create).not.toHaveBeenCalled();
    expect(db.budgetAction.update).not.toHaveBeenCalled();
    expect(db.budgetPost.upsert).not.toHaveBeenCalled();
    expect(db.fiscalYear.update).not.toHaveBeenCalled();
    expect(db.auditLog.create.mock.calls[0][0].data.diffJson.historicalOnly).toBe(true);
  });
  it("requires manual resolution of ambiguous matches before mutating", async () => {
    db.budgetAction.findMany.mockResolvedValue([existing(), { ...existing(), id: "duplicate" }]);
    await expect(applyBudgetMatrix(params())).rejects.toThrow("Rapprochement ambigu");
    expect(db.budgetAction.update).not.toHaveBeenCalled();
    expect(db.budgetPost.upsert).not.toHaveBeenCalled();
    await applyBudgetMatrix({ ...params(), overrides: { 8: "old" } });
    expect(db.budgetAction.update).toHaveBeenCalledOnce();
  });
  it("writes the import audit inside the suppressed transaction and propagates an audit failure", async () => {
    db.auditLog.create.mockImplementation(async () => {
      expect(getAuditContext()).toBeUndefined();
      expect(db.budgetSnapshot.create).toHaveBeenCalledOnce();
      throw new Error("audit unavailable");
    });
    await runWithAuditContext("user", async () => {
      await expect(applyBudgetMatrix(params())).rejects.toThrow("audit unavailable");
      expect(getAuditContext()?.userId).toBe("user");
    });
    expect(auditLogCreate).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalledOnce();
  });
});
