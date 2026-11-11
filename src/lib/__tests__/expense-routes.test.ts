import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  expense: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  season: { findUnique: vi.fn() }, budgetCategory: { findUnique: vi.fn() }, competition: { findUnique: vi.fn() },
  budgetAction: { findUnique: vi.fn(), findMany: vi.fn() },
}));
const authenticate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({ runAsAuthenticatedUser: authenticate }));
import { GET as listExpenses, POST } from "@/app/api/expenses/route";
import { PATCH } from "@/app/api/expenses/[id]/route";
import { GET as listActions } from "@/app/api/budget-actions/route";

const body = { seasonId: "season", categoryId: "category", competitionId: "competition", date: "2026-05-10", amount: "100", description: "Trajet Doha" };
const actionRelation = { id: "action", label: "Doha GP", post: { code: "C", fiscalYear: { label: "2026" } } };
const relationSelect = { budgetActionId: true, budgetAction: { select: { id: true, label: true, post: { select: { code: true, fiscalYear: { select: { label: true } } } } } } };
const invalidAction = { error: "L’action budgétaire sélectionnée est introuvable ou son budget n’est pas encore voté" };
const request = (method: string, data: object) => new Request("http://localhost/api/expenses/expense", {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
});
const patch = (changes: object = {}) => PATCH(request("PATCH", { ...body, ...changes }), { params: { id: "expense" } });
const getActions = (season: string) => listActions(new Request("http://localhost/api/budget-actions?season=" + encodeURIComponent(season)));
beforeEach(() => {
  vi.resetAllMocks();
  authenticate.mockImplementation((operation: (id: string) => Promise<unknown>) => operation("user"));
  db.season.findUnique.mockResolvedValue({ id: "season", startDate: new Date("2025-09-01"), endDate: new Date("2026-08-31") });
  db.budgetCategory.findUnique.mockResolvedValue({ id: "category", seasonId: "season" });
  db.competition.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, seasonId: "season" }));
  db.expense.findUnique.mockResolvedValue({ id: "expense", seasonId: "season", competitionId: "competition", budgetActionId: "kept" });
  db.expense.findMany.mockResolvedValue([{ ...body, id: "expense", budgetActionId: "action", budgetAction: actionRelation }]);
  db.expense.create.mockResolvedValue({ id: "expense" });
  db.expense.update.mockImplementation(async ({ data }) => ({ id: "expense", ...data, budgetAction: data.budgetActionId ? actionRelation : null }));
  db.budgetAction.findUnique.mockResolvedValue({ id: "action", post: { fiscalYear: { phase: "EXECUTION" } } });
  db.budgetAction.findMany.mockResolvedValue([{ id: "automatic", competitionId: "competition", post: { fiscalYear: { label: "2026" } } }]);
});
describe("création des notes de frais rattachées", () => {
  it("enregistre une action explicite et garde les droits d’écriture", async () => {
    const response = await POST(request("POST", { ...body, budgetActionId: "action" }));
    expect(response.status).toBe(201);
    expect(db.expense.create.mock.lastCall?.[0].data).toMatchObject({ budgetActionId: "action", createdById: "user" });
    expect(authenticate.mock.lastCall?.[1]).toEqual(["ADMIN", "COMEH_MEMBER"]);
    expect(db.budgetAction.findMany).not.toHaveBeenCalled();
  });
  it.each([null, { id: "action", post: { fiscalYear: { phase: "PREPARATION" } } }])("refuse une action indisponible %j", async action => {
    db.budgetAction.findUnique.mockResolvedValue(action);
    const response = await POST(request("POST", { ...body, budgetActionId: "action" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(invalidAction);
    expect(db.expense.create).not.toHaveBeenCalled();
  });
  it("rattache automatiquement le champ absent", async () => {
    expect((await POST(request("POST", body))).status).toBe(201);
    expect(db.expense.create.mock.lastCall?.[0].data.budgetActionId).toBe("automatic");
    expect(db.budgetAction.findMany).toHaveBeenCalledTimes(1);
  });
  it("respecte le choix explicite sans action", async () => {
    expect((await POST(request("POST", { ...body, budgetActionId: null }))).status).toBe(201);
    expect(db.expense.create.mock.lastCall?.[0].data.budgetActionId).toBeNull();
    expect(db.budgetAction.findMany).not.toHaveBeenCalled();
    expect(db.budgetAction.findUnique).not.toHaveBeenCalled();
  });
});
describe("modification des notes de frais rattachées", () => {
  it("garde l’action quand seule la date change et que le champ est absent", async () => {
    const response = await patch({ date: "2025-12-10" });
    expect(response.status).toBe(200);
    expect(db.expense.update.mock.lastCall?.[0].data.budgetActionId).toBe("kept");
    expect(db.expense.findUnique.mock.lastCall?.[0].select).toMatchObject({ competitionId: true, budgetActionId: true });
    expect(db.expense.update.mock.lastCall?.[0].select).toMatchObject(relationSelect);
    expect((await response.json()).budgetAction).toEqual(actionRelation);
    expect(db.budgetAction.findUnique).not.toHaveBeenCalled();
    expect(db.budgetAction.findMany).not.toHaveBeenCalled();
  });
  it("recalcule le rattachement quand la compétition change", async () => {
    db.budgetAction.findMany.mockResolvedValue([{ id: "new-action", competitionId: "new-competition", post: { fiscalYear: { label: "2026" } } }]);
    expect((await patch({ competitionId: "new-competition" })).status).toBe(200);
    expect(db.expense.update.mock.lastCall?.[0].data.budgetActionId).toBe("new-action");
    expect(db.budgetAction.findMany.mock.lastCall?.[0].where.competitionId).toBe("new-competition");
  });
  it("détache en automatique quand la compétition est retirée", async () => {
    expect((await patch({ competitionId: null })).status).toBe(200);
    expect(db.expense.update.mock.lastCall?.[0].data.budgetActionId).toBeNull();
    expect(db.budgetAction.findMany).not.toHaveBeenCalled();
  });
  it("détache avec null même si la compétition reste présente", async () => {
    const response = await patch({ budgetActionId: null });
    expect(response.status).toBe(200);
    expect(db.expense.update.mock.lastCall?.[0].data.budgetActionId).toBeNull();
    expect((await response.json()).budgetAction).toBeNull();
    expect(db.budgetAction.findMany).not.toHaveBeenCalled();
    expect(db.budgetAction.findUnique).not.toHaveBeenCalled();
  });
  it("vérifie une action explicite même si la compétition change", async () => {
    expect((await patch({ competitionId: "new-competition", budgetActionId: "action" })).status).toBe(200);
    expect(db.expense.update.mock.lastCall?.[0].data.budgetActionId).toBe("action");
    expect(db.budgetAction.findMany).not.toHaveBeenCalled();
  });
  it("refuse une action explicite non votée", async () => {
    db.budgetAction.findUnique.mockResolvedValue({ id: "action", post: { fiscalYear: { phase: "PREPARATION" } } });
    const response = await patch({ budgetActionId: "action" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(invalidAction);
    expect(db.expense.update).not.toHaveBeenCalled();
  });
});
describe("lecture des rattachements et des actions", () => {
  it("inclut le rattachement dans la liste des notes de frais", async () => {
    const response = await listExpenses(new Request("http://localhost/api/expenses?seasonId=season"));
    expect(response.status).toBe(200);
    expect(db.expense.findMany.mock.lastCall?.[0].select).toMatchObject(relationSelect);
    expect((await response.json())[0]).toMatchObject({ budgetActionId: "action", budgetAction: actionRelation });
  });
  it.each(["", "2026", "25/27", "invalid"])("refuse la saison %j sans lecture", async season => {
    const response = await getActions(season);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Saison invalide" });
    expect(authenticate).not.toHaveBeenCalled();
    expect(db.budgetAction.findMany).not.toHaveBeenCalled();
  });
  it("interroge les deux exercices votés et demande le tri par exercice, poste puis action", async () => {
    const actions = [
      { id: "a", label: "Stage", competitionId: null, plannedMonth: 10, post: { code: "B", label: "Stages", fiscalYear: { label: "2025" } } },
      { id: "b", label: "Doha GP", competitionId: "competition", plannedMonth: 2, post: { code: "C", label: "Compétitions", fiscalYear: { label: "2026" } } },
    ];
    db.budgetAction.findMany.mockResolvedValue(actions);
    const response = await getActions("25/26");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(authenticate.mock.lastCall).toHaveLength(1);
    expect(db.budgetAction.findMany).toHaveBeenCalledTimes(1);
    expect(db.budgetAction.findMany.mock.lastCall?.[0]).toMatchObject({
      where: { post: { fiscalYear: { label: { in: ["2025", "2026"] }, phase: "EXECUTION" } } },
      orderBy: [{ post: { fiscalYear: { label: "asc" } } }, { post: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    });
    expect(await response.json()).toEqual([
      { id: "a", label: "Stage", postCode: "B", postLabel: "Stages", fiscalYearLabel: "2025", plannedMonth: 10, competitionId: null },
      { id: "b", label: "Doha GP", postCode: "C", postLabel: "Compétitions", fiscalYearLabel: "2026", plannedMonth: 2, competitionId: "competition" },
    ]);
  });
});
