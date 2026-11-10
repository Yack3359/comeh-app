import { beforeEach, describe, expect, it, vi } from "vitest";
import { pilotageAction, post } from "./budget-fixtures";

const db = vi.hoisted(() => ({
  fiscalYear: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  budgetPost: { findUnique: vi.fn(), create: vi.fn() }, budgetAction: { aggregate: vi.fn(), findMany: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
  season: { findUnique: vi.fn() }, $transaction: vi.fn(),
}));
const authenticate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({ runAsAuthenticatedUser: authenticate }));
import { POST as create } from "@/app/api/budget-preparation/lines/route";
import { PATCH as update, DELETE as remove } from "@/app/api/budget-preparation/lines/[id]/route";
import { POST as open } from "@/app/api/budget-preparation/open/route";
import { POST as vote } from "@/app/api/budget-preparation/vote/route";
import { POST as reopen } from "@/app/api/budget-preparation/reopen/route";
import { PATCH as updateYear } from "@/app/api/fiscal-years/[id]/route";

const year = { id: "fy", label: "2027", phase: "PREPARATION", _count: { budgetSnapshots: 0, budgetPosts: 0 }, targetFederation: null, restitutionAmount: 0 };
const row = (proposalStatus = "PROPOSED") => ({ ...pilotageAction(), id: proposalStatus, postId: post.id, proposalStatus,
  initialGross: 0, initialClubIncome: 0, post: { ...post, fiscalYearId: "fy", fiscalYear: year }, revisedGross: 30500, revisedFederation: 19500, revisedClubIncome: 11000 });
const request = (body: object, method = "POST") => new Request("http://localhost/api/budget-preparation", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const context = { params: { id: "line" } };
beforeEach(() => {
  vi.resetAllMocks();
  authenticate.mockImplementation((operation: (id: string) => Promise<unknown>) => operation("coach"));
  db.$transaction.mockImplementation((operation: (tx: typeof db) => Promise<unknown>) => operation(db));
  db.fiscalYear.findUniqueOrThrow.mockResolvedValue(year);
  db.fiscalYear.findUnique.mockResolvedValue(year);
  db.fiscalYear.upsert.mockResolvedValue(year);
  db.fiscalYear.update.mockImplementation(async ({ data }) => ({ ...year, ...data }));
  db.budgetPost.findUnique.mockResolvedValue({ ...post, fiscalYearId: "fy", fiscalYear: year });
  db.budgetPost.create.mockResolvedValue(post);
  db.budgetAction.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
  db.season.findUnique.mockImplementation(async ({ where }) => ({ id: "season-" + where.label }));
  db.budgetAction.findUniqueOrThrow.mockResolvedValue(row());
  db.budgetAction.findMany.mockResolvedValue([row("VALIDATED"), row("PROPOSED"), row("ARBITRATION"), row("REJECTED")]);
  db.budgetAction.create.mockImplementation(async ({ data }) => ({ ...row(), ...data }));
  db.budgetAction.update.mockImplementation(async ({ data }) => ({ ...row(), ...data }));
});
describe("routes de préparation", () => {
  it("autorise les entraîneurs sur les lignes et calcule les recettes", async () => {
    const response = await create(request({ postId: post.id, label: "Doha", revisedGross: 21700, revisedFederation: 10900 }));
    expect(response.status).toBe(201);
    expect(authenticate.mock.lastCall?.[1]).toEqual(["ADMIN", "COMEH_MEMBER", "CONTRIBUTOR"]);
    expect(db.budgetAction.create.mock.lastCall?.[0].data).toMatchObject({ revisedClubIncome: 10800, proposalStatus: "PROPOSED", proposedById: "coach", status: "OPTION", includedInBudget: false, initialFederation: 0 });
    expect((await update(request({ revisedFederation: 20000 }, "PATCH"), context)).status).toBe(200);
    expect(db.budgetAction.update.mock.lastCall?.[0].data.revisedClubIncome).toBe(10500);
    expect(authenticate.mock.lastCall?.[1]).toEqual(["ADMIN", "COMEH_MEMBER", "CONTRIBUTOR"]);
    expect((await remove(request({}, "DELETE"), context)).status).toBe(200);
    expect(authenticate.mock.lastCall?.[1]).toEqual(["ADMIN", "COMEH_MEMBER", "CONTRIBUTOR"]);
  });
  it.each([null, 0, 42])("ajoute la ligne en fin de poste après %s", async sortOrder => {
    db.budgetAction.aggregate.mockResolvedValue({ _max: { sortOrder } });
    expect((await create(request({ postId: post.id, label: "Stage" }))).status).toBe(201);
    expect(db.budgetAction.aggregate).toHaveBeenCalledWith({ where: { postId: post.id }, _max: { sortOrder: true } });
    expect(db.budgetAction.create.mock.lastCall?.[0].data.sortOrder).toBe((sortOrder ?? 0) + 10);
  });
  it.each([[1, "26/27"], [8, "26/27"], [9, "27/28"], [12, "27/28"], [null, null]] as const)("déduit la saison à la création et à la modification du mois %s", async (plannedMonth, label) => {
    expect((await create(request({ postId: post.id, label: "Stage", plannedMonth }))).status).toBe(201);
    expect(db.budgetAction.create.mock.lastCall?.[0].data.seasonId).toBe(label ? "season-" + label : null);
    expect((await update(request({ plannedMonth }, "PATCH"), context)).status).toBe(200);
    expect(db.budgetAction.update.mock.lastCall?.[0].data.seasonId).toBe(label ? "season-" + label : null);
    if (label) expect(db.season.findUnique).toHaveBeenCalledWith({ where: { label }, select: { id: true } });
    else expect(db.season.findUnique).not.toHaveBeenCalled();
  });
  it("laisse la saison nulle si elle n’existe pas et la préserve si le mois n’est pas fourni", async () => {
    db.season.findUnique.mockResolvedValue(null);
    expect((await create(request({ postId: post.id, label: "Stage", plannedMonth: 2 }))).status).toBe(201);
    expect(db.budgetAction.create.mock.lastCall?.[0].data.seasonId).toBeNull();
    expect((await update(request({ plannedMonth: 10 }, "PATCH"), context)).status).toBe(200);
    expect(db.budgetAction.update.mock.lastCall?.[0].data.seasonId).toBeNull();
    db.season.findUnique.mockClear();
    expect((await update(request({ label: "Stage renommé" }, "PATCH"), context)).status).toBe(200);
    expect(db.budgetAction.update.mock.lastCall?.[0].data).not.toHaveProperty("seasonId");
    expect(db.season.findUnique).not.toHaveBeenCalled();
  });
  it("refuse toute modification après le vote", async () => {
    db.budgetPost.findUnique.mockResolvedValue({ ...post, fiscalYear: { ...year, phase: "EXECUTION" } });
    db.budgetAction.findUniqueOrThrow.mockResolvedValue({ ...row(), post: { ...post, fiscalYear: { ...year, phase: "EXECUTION" } } });
    expect((await create(request({ postId: post.id, label: "Stage" }))).status).toBe(409);
    expect((await update(request({ label: "Stage" }, "PATCH"), context)).status).toBe(409);
    expect((await remove(request({}, "DELETE"), context)).status).toBe(409);
    expect(db.budgetAction.create).not.toHaveBeenCalled(); expect(db.budgetAction.update).not.toHaveBeenCalled(); expect(db.budgetAction.delete).not.toHaveBeenCalled();
  });
  it("contrôle le montant résultant et les changements de poste", async () => {
    expect((await update(request({ revisedGross: 100 }, "PATCH"), context)).status).toBe(400);
    db.budgetPost.findUnique.mockResolvedValue({ id: "foreign", fiscalYearId: "other" });
    expect((await update(request({ postId: "foreign" }, "PATCH"), context)).status).toBe(400);
    expect(db.budgetAction.update).not.toHaveBeenCalled();
  });
  it.each([{ revisedClubIncome: 10 }, { initialFederation: 10 }, { proposedById: "other" }, { status: "DONE" }, { athleteCount: 1000 }, { dayCount: 1.5 }, { staffCount: -1 }])("refuse les champs hors contrat %j", async extra => {
    expect((await create(request({ postId: post.id, label: "Stage", ...extra }))).status).toBe(400);
  });
  it("renvoie les compteurs sans voter si des décisions sont en attente", async () => {
    const response = await vote(request({ fiscalYearLabel: "2027", keepPending: false }));
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ pending: 1, arbitration: 1 });
    expect(db.budgetAction.update).not.toHaveBeenCalled(); expect(db.fiscalYear.update).not.toHaveBeenCalled();
    expect(authenticate.mock.lastCall?.[1]).toEqual(["ADMIN", "COMEH_MEMBER"]);
  });
  it("vote avec des options, puis passe l’exercice en exécution", async () => {
    expect((await vote(request({ fiscalYearLabel: "2027", keepPending: true }))).status).toBe(200);
    const writes = db.budgetAction.update.mock.calls.map(call => call[0]);
    expect(writes.find(write => write.where.id === "VALIDATED").data).toMatchObject({ status: "BUDGETED", includedInBudget: true, initialGross: 30500, initialFederation: 19500, initialClubIncome: 11000 });
    expect(writes.find(write => write.where.id === "ARBITRATION").data).toMatchObject({ status: "OPTION", initialFederation: 0 });
    expect(writes.find(write => write.where.id === "REJECTED").data.status).toBe("CANCELLED");
    expect(db.fiscalYear.update.mock.lastCall?.[0].data.phase).toBe("EXECUTION");
  });
  it("vote sans keepPending quand toutes les décisions sont rendues", async () => {
    db.budgetAction.findMany.mockResolvedValue([row("VALIDATED"), row("REJECTED")]);
    expect((await vote(request({ fiscalYearLabel: "2027", keepPending: false }))).status).toBe(200);
    db.fiscalYear.findUniqueOrThrow.mockResolvedValue({ ...year, phase: "EXECUTION" });
    expect((await vote(request({ fiscalYearLabel: "2027", keepPending: true }))).status).toBe(409);
  });
  it("refuse de rouvrir un exercice déjà en préparation sans rien modifier", async () => {
    const response = await reopen(request({ fiscalYearLabel: "2027" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Cet exercice est déjà en préparation" });
    expect(db.budgetAction.updateMany).not.toHaveBeenCalled(); expect(db.fiscalYear.update).not.toHaveBeenCalled();
  });
  it("réserve la réouverture à l’admin et bloque les imports existants", async () => {
    db.fiscalYear.findUniqueOrThrow.mockResolvedValue({ ...year, phase: "EXECUTION" });
    expect((await reopen(request({ fiscalYearLabel: "2027" }))).status).toBe(200);
    expect(authenticate.mock.lastCall?.[1]).toEqual(["ADMIN"]);
    expect(db.budgetAction.updateMany.mock.lastCall?.[0].data).toMatchObject({ status: "OPTION", includedInBudget: false, initialGross: 0, initialFederation: 0 });
    db.fiscalYear.findUniqueOrThrow.mockResolvedValue({ ...year, phase: "EXECUTION", _count: { budgetSnapshots: 1 } });
    expect((await reopen(request({ fiscalYearLabel: "2027" }))).status).toBe(409);
  });
  it("ouvre une trame, copie les références et fixe l’échéance", async () => {
    db.fiscalYear.findUnique.mockResolvedValueOnce(year).mockResolvedValueOnce({ label: "2026", budgetPosts: [{ ...post, label: "Compétitions 2026", actions: [{ ...row(), fencingCategories: ["M20"], plannedMonth: 2 }] }] });
    expect((await open(request({ fiscalYearLabel: "2027", copyFromPrevious: true }))).status).toBe(201);
    expect(authenticate.mock.lastCall?.[1]).toEqual(["ADMIN", "COMEH_MEMBER"]);
    expect(db.fiscalYear.upsert.mock.lastCall?.[0].update).toMatchObject({ phase: "PREPARATION", preparationDeadline: new Date("2026-12-15") });
    expect(db.budgetPost.create.mock.lastCall?.[0].data.label).toBe("Compétitions 2027");
    expect(db.budgetAction.create.mock.lastCall?.[0].data).toMatchObject({ sourceActionId: "PROPOSED", previousYearAmount: 19500, amountsConfirmed: false });
  });
  it.each(["budgetPosts", "budgetSnapshots"])("n’écrase pas les %s existants", async field => {
    db.fiscalYear.findUnique.mockResolvedValue({ ...year, _count: { budgetPosts: 0, budgetSnapshots: 0, [field]: 1 } });
    expect((await open(request({ fiscalYearLabel: "2027", copyFromPrevious: false }))).status).toBe(409);
    expect(db.fiscalYear.upsert).not.toHaveBeenCalled();
  });
  it("accepte l’enveloppe et une date réelle, avec au moins un champ", async () => {
    expect((await updateYear(request({ targetFederation: 240000, preparationDeadline: "2026-12-15" }, "PATCH"), context)).status).toBe(200);
    expect(authenticate.mock.lastCall?.[1]).toEqual(["ADMIN", "COMEH_MEMBER"]);
    expect(db.fiscalYear.update.mock.lastCall?.[0].data).toMatchObject({ targetFederation: 240000, preparationDeadline: new Date("2026-12-15") });
    expect((await updateYear(request({ targetFederation: null, preparationDeadline: null }, "PATCH"), context)).status).toBe(200);
    expect((await updateYear(request({ preparationDeadline: "2026-02-30" }, "PATCH"), context)).status).toBe(400);
    expect((await updateYear(request({}, "PATCH"), context)).status).toBe(400);
  });
});
