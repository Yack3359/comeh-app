import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickActionForExpense, resolveExpenseAction, type ActionCandidate } from "../expense-action";
import { expenseCreateSchema, expenseUpdateSchema } from "../budget-validations";

const candidate = (id: string, fiscalYearLabel = "2026", competitionId: string | null = "competition"): ActionCandidate => ({ id, competitionId, fiscalYearLabel });
describe("rattachement automatique des notes de frais", () => {
  it("ne rattache rien sans compétition ni candidat correspondant", () => {
    expect(pickActionForExpense([candidate("a", "2026", null)], null, "2026-12-01")).toBeNull();
    expect(pickActionForExpense([], "competition", "2026-12-01")).toBeNull();
    expect(pickActionForExpense([candidate("a", "2026", "autre")], "competition", "2026-12-01")).toBeNull();
  });
  it("retient le candidat unique même dans un autre exercice", () => {
    expect(pickActionForExpense([candidate("a", "2027"), candidate("autre", "2026", "autre")], "competition", "2026-12-01")).toBe("a");
  });
  it("départage plusieurs actions par l’année de la dépense", () => {
    expect(pickActionForExpense([candidate("a", "2025"), candidate("b")], "competition", "2026-12-01")).toBe("b");
  });
  it("laisse les candidats ambigus sans rattachement", () => {
    expect(pickActionForExpense([candidate("a"), candidate("b")], "competition", "2026-12-01")).toBeNull();
    expect(pickActionForExpense([candidate("a", "2025"), candidate("b", "2027")], "competition", "2026-12-01")).toBeNull();
  });
});

const client = { budgetAction: { findUnique: vi.fn(), findMany: vi.fn() } };
const input = { competitionId: "competition", date: "2026-12-01" };
beforeEach(() => vi.resetAllMocks());
describe("résolution du rattachement", () => {
  it("accepte une action explicite d’un exercice voté sans filtre d’année ou de compétition", async () => {
    client.budgetAction.findUnique.mockResolvedValue({ id: "a", post: { fiscalYear: { phase: "EXECUTION" } } });
    expect(await resolveExpenseAction(client, { ...input, competitionId: null, requested: "a" })).toEqual({ ok: true, budgetActionId: "a" });
    expect(client.budgetAction.findUnique).toHaveBeenCalledWith({ where: { id: "a" }, select: { id: true, post: { select: { fiscalYear: { select: { phase: true } } } } } });
    expect(client.budgetAction.findMany).not.toHaveBeenCalled();
  });
  it.each([null, { id: "a", post: { fiscalYear: { phase: "PREPARATION" } } }])("refuse l’action absente ou non votée %j", async action => {
    client.budgetAction.findUnique.mockResolvedValue(action);
    expect(await resolveExpenseAction(client, { ...input, requested: "a" })).toEqual({ ok: false });
  });
  it("détache explicitement sans lire la base", async () => {
    expect(await resolveExpenseAction(client, { ...input, requested: null })).toEqual({ ok: true, budgetActionId: null });
    expect(client.budgetAction.findUnique).not.toHaveBeenCalled();
    expect(client.budgetAction.findMany).not.toHaveBeenCalled();
  });
  it("ne lit pas la base en automatique sans compétition", async () => {
    expect(await resolveExpenseAction(client, { ...input, competitionId: null, requested: undefined })).toEqual({ ok: true, budgetActionId: null });
    expect(client.budgetAction.findMany).not.toHaveBeenCalled();
  });
  it("cherche les actions votées et départage par l’année", async () => {
    client.budgetAction.findMany.mockResolvedValue(["2025", "2026"].map(label => ({ id: label, competitionId: "competition", post: { fiscalYear: { label } } })));
    expect(await resolveExpenseAction(client, { ...input, requested: undefined })).toEqual({ ok: true, budgetActionId: "2026" });
    expect(client.budgetAction.findMany).toHaveBeenCalledWith({ where: { competitionId: "competition", post: { fiscalYear: { phase: "EXECUTION" } } },
      select: { id: true, competitionId: true, post: { select: { fiscalYear: { select: { label: true } } } } } });
    expect(client.budgetAction.findUnique).not.toHaveBeenCalled();
  });
});
describe("validation du choix d’action", () => {
  it("conserve la différence entre absent, null et identifiant", () => {
    const body = { seasonId: "season", categoryId: "category", amount: "10", date: "2026-12-01", description: "Trajet" };
    for (const schema of [expenseCreateSchema, expenseUpdateSchema]) {
      expect(schema.parse(body)).not.toHaveProperty("budgetActionId");
      expect(schema.parse({ ...body, budgetActionId: null }).budgetActionId).toBeNull();
      expect(schema.parse({ ...body, budgetActionId: "action" }).budgetActionId).toBe("action");
      expect(schema.safeParse({ ...body, budgetActionId: "" }).success).toBe(false);
    }
  });
});
