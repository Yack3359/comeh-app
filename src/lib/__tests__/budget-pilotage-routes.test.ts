import { beforeEach, describe, expect, it, vi } from "vitest";
import { existingAction, matrixWorkbook, pilotageAction, post } from "./budget-fixtures";

const db = vi.hoisted(() => ({
  fiscalYear: { findUnique: vi.fn() }, budgetPost: { findMany: vi.fn(), findUnique: vi.fn() },
  budgetAction: { findMany: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
  season: { findUnique: vi.fn() }, $transaction: vi.fn(),
}));
const authenticate = vi.hoisted(() => vi.fn());
const apply = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({ runAsAuthenticatedUser: authenticate }));
vi.mock("@/lib/import-storage", () => ({ uploadBudgetMatrixFile: vi.fn().mockResolvedValue("matrix.xlsx") }));
vi.mock("@/lib/budget-matrix-apply", async importOriginal => ({
  ...await importOriginal<typeof import("../budget-matrix-apply")>(), applyBudgetMatrix: apply,
}));
import { MatrixChronologyError } from "../budget-matrix-apply";
import { POST as preview, maxDuration as previewDuration } from "@/app/api/budget-matrix/preview/route";
import { POST as applyRoute, maxDuration as applyDuration } from "@/app/api/budget-matrix/apply/route";
import { POST as createAction } from "@/app/api/budget-actions/route";
import { PATCH as patchAction } from "@/app/api/budget-actions/[id]/route";

const action = () => ({ ...pilotageAction(), ...existingAction(), postId: post.id, post: { ...post },
  initialGross: 5000, initialClubIncome: 1000, comment: null, clubIncomeWaived: 0, clubIncomeFollowUp: null, clubIncomeNote: null });
async function upload(fields: Record<string, string> = {}) {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(await matrixWorkbook().xlsx.writeBuffer())]), "matrix.xlsx");
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return new Request("http://localhost/api/budget-matrix", { method: "POST", body: form });
}
const jsonRequest = (method: string, body: object) => new Request("http://localhost/api/budget-actions/old", {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  authenticate.mockImplementation((operation: (id: string) => Promise<unknown>) => operation("user"));
  db.fiscalYear.findUnique.mockResolvedValue({ id: "fy", label: "2026" });
  db.budgetPost.findMany.mockResolvedValue([post]);
  db.budgetAction.findMany.mockResolvedValue([action()]);
  db.budgetPost.findUnique.mockResolvedValue({ ...post, fiscalYear: { label: "2026" } });
  db.budgetAction.findUniqueOrThrow.mockResolvedValue(action());
  db.budgetAction.update.mockImplementation(async ({ data }) => ({ ...action(), ...data }));
  db.budgetAction.create.mockImplementation(async ({ data }) => ({ ...action(), ...data }));
  db.$transaction.mockImplementation(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db));
  apply.mockReset();
  apply.mockResolvedValue({ snapshotId: "snapshot", created: 0, updated: 0, unchanged: 1, missing: 0 });
});
describe("matrix API safeguards", () => {
  it("refuses a matrix during preparation before uploading", async () => {
    db.fiscalYear.findUnique.mockResolvedValue({ id: "fy", label: "2026", phase: "PREPARATION" });
    const response = await applyRoute(await upload({ payload: JSON.stringify({ fiscalYearLabel: "2026", asOfDate: "2026-10-25" }) }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("Votez d’abord");
    expect(apply).not.toHaveBeenCalled();
    expect(authenticate.mock.lastCall?.[1]).toEqual(["ADMIN", "COMEH_MEMBER"]);
  });
  it("recalculates the preview with multipart JSON overrides", async () => {
    const first = await preview(await upload());
    const before = await first.json();
    expect(before.diff.actions.find((row: { rowNumber: number }) => row.rowNumber === 8).actionId).toBe("old");
    const response = await preview(await upload({ overrides: JSON.stringify({ 8: null }) }));
    expect(response.status).toBe(200);
    const after = await response.json();
    expect(after.diff.actions.find((row: { rowNumber: number }) => row.rowNumber === 8)).toMatchObject({ actionId: null, kind: "new", ambiguous: false });
    expect(after.diff.missingActions.map((row: { id: string }) => row.id)).toContain("old");
  });
  it.each(["{", '{"0":null}', '{"8":123}', '{"8":"foreign"}'])("rejects invalid preview overrides %s", async overrides => {
    expect((await preview(await upload({ overrides }))).status).toBe(400);
  });
  it.each([preview, applyRoute])("returns 413 before reading an oversized body", async route => {
    const request = new Request("http://localhost/api/budget-matrix", { method: "POST", headers: { "content-length": String(6 * 1024 * 1024 + 1) } });
    const formData = vi.spyOn(request, "formData");
    expect((await route(request)).status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
  });
  it("returns an explicit 409 for an older matrix and forwards historical-only mode", async () => {
    apply.mockRejectedValueOnce(new MatrixChronologyError("Matrice antérieure : importer comme historique seulement"));
    const payload = { fiscalYearLabel: "2026", asOfDate: "2026-09-08" };
    const response = await applyRoute(await upload({ payload: JSON.stringify(payload) }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("antérieure");
    expect((await applyRoute(await upload({ payload: JSON.stringify({ ...payload, historicalOnly: true }) }))).status).toBe(200);
    expect(apply.mock.lastCall?.[0]).toMatchObject({ historicalOnly: true });
  });
  it("requires an explicit match before applying ambiguity and gives both routes 120 seconds", async () => {
    db.budgetAction.findMany.mockResolvedValue([action(), { ...action(), id: "duplicate" }]);
    const payload = { fiscalYearLabel: "2026", asOfDate: "2026-10-25" };
    const response = await applyRoute(await upload({ payload: JSON.stringify(payload) }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("ambigu");
    expect(apply).not.toHaveBeenCalled();
    expect(previewDuration).toBe(120);
    expect(applyDuration).toBe(120);
  });
});
describe("manual action API inclusion", () => {
  it.each(["BUDGETED", "COMMITTED", "DONE", "OPTION", "UNBUDGETED", "CANCELLED"] as const)("synchronizes POST and PATCH for %s while saving settlement", async status => {
    const included = status !== "OPTION" && status !== "UNBUDGETED";
    const created = await createAction(jsonRequest("POST", { label: "Action", postId: post.id, status, settled: false }));
    expect(created.status).toBe(201);
    expect(authenticate.mock.lastCall?.[1]).toEqual(["ADMIN", "COMEH_MEMBER"]);
    expect(db.budgetAction.create.mock.lastCall?.[0].data).toMatchObject({ status, includedInBudget: included, settled: false });
    for (const current of [true, false]) {
      db.budgetAction.findUniqueOrThrow.mockResolvedValue({ ...action(), includedInBudget: current });
      const updated = await patchAction(jsonRequest("PATCH", { status, includedInBudget: !current, settled: null }), { params: { id: "old" } });
      expect(updated.status).toBe(200);
      expect(authenticate.mock.lastCall?.[1]).toEqual(["ADMIN", "COMEH_MEMBER"]);
      expect(db.budgetAction.update.mock.lastCall?.[0].data).toMatchObject({ status, includedInBudget: status === "CANCELLED" ? current : included, settled: null });
    }
  });
});

describe("suivi des recettes clubs par PATCH", () => {
  it.each([
    [{ clubIncomeWaived: 81, clubIncomeNote: "Accord" }, "Le montant annulé dépasse ce qui reste à encaisser"],
    [{ clubIncomeWaived: 30 }, "Expliquez pourquoi cette recette est annulée"],
    [{ clubIncomeWaived: 30, clubIncomeNote: "   " }, "Expliquez pourquoi cette recette est annulée"],
    [{ clubIncomeWaived: 30, status: "CANCELLED", clubIncomeNote: "Accord" }, "Le montant annulé dépasse ce qui reste à encaisser"],
    [{ clubIncomeWaived: 30, status: "OPTION", clubIncomeNote: "Accord" }, "Le montant annulé dépasse ce qui reste à encaisser"],
    [{ clubIncomeWaived: 30, revisedClubIncome: 40, revisionReason: "Révision", clubIncomeNote: "Accord" }, "Le montant annulé dépasse ce qui reste à encaisser"],
  ])("refuse une annulation invalide %j", async (body, message) => {
    db.budgetAction.findUniqueOrThrow.mockResolvedValue({ ...action(), revisedClubIncome: 100, actualClubIncome: 20 });
    const response = await patchAction(jsonRequest("PATCH", body as object), { params: { id: "old" } });
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain(message);
    expect(db.budgetAction.update).not.toHaveBeenCalled();
  });
  it("accepte l’annulation au plafond avec explication, sans motif de révision", async () => {
    db.budgetAction.findUniqueOrThrow.mockResolvedValue({ ...action(), revisedClubIncome: 100, actualClubIncome: 20 });
    const body = { clubIncomeWaived: 80, clubIncomeFollowUp: "DISPUTED", clubIncomeNote: "  Accord du club  " };
    const response = await patchAction(jsonRequest("PATCH", body), { params: { id: "old" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ clubIncomeWaived: 80, clubIncomeFollowUp: "DISPUTED", clubIncomeNote: "Accord du club" });
    expect(db.budgetAction.update.mock.lastCall?.[0].data).not.toHaveProperty("revisionReason");
    expect(authenticate.mock.lastCall?.[1]).toEqual(["ADMIN", "COMEH_MEMBER"]);
  });
  it("valide aussi les valeurs conservées et ignore les modifications sans champ de suivi", async () => {
    db.budgetAction.findUniqueOrThrow.mockResolvedValue({ ...action(), revisedClubIncome: 100, actualClubIncome: 20, clubIncomeWaived: 80, clubIncomeNote: "Accord" });
    expect((await patchAction(jsonRequest("PATCH", { clubIncomeFollowUp: "REMINDED" }), { params: { id: "old" } })).status).toBe(200);
    expect((await patchAction(jsonRequest("PATCH", { clubIncomeNote: null }), { params: { id: "old" } })).status).toBe(400);
    expect((await patchAction(jsonRequest("PATCH", { status: "CANCELLED" }), { params: { id: "old" } })).status).toBe(200);
    expect((await patchAction(jsonRequest("PATCH", { status: "CANCELLED", clubIncomeFollowUp: "REMINDED" }), { params: { id: "old" } })).status).toBe(400);
  });
});
