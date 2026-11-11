import { describe, expect, it } from "vitest";
import { buildClubIncome, listClubIncomePoints } from "../budget-club-income";

const post = { id: "post-b", code: "B", label: "Stages" };
const context = { asOfDate: new Date("2026-10-25"), fiscalYearLabel: "2026" };
type IncomeAction = Parameters<typeof buildClubIncome>[1][number];
const action = (overrides: Partial<IncomeAction> = {}): IncomeAction => ({ id: "a", label: "Stage", postId: post.id, postCode: post.code,
  plannedMonth: 4, status: "BUDGETED", revisedClubIncome: 100, actualClubIncome: null, ...overrides });

describe("recettes clubs par action", () => {
  it.each(["CANCELLED", "OPTION"])("annule l’attendu pour %s et conserve les encaissements", status => {
    expect(buildClubIncome([post], [action({ status })], context).lines).toEqual([]);
    expect(buildClubIncome([post], [action({ status, actualClubIncome: 20 })], context).lines).toEqual([
      { id: "a", label: "Stage", postId: post.id, postCode: post.code, plannedMonth: 4, expected: 0, collected: 20, outstanding: 0, state: "COLLECTED", overdue: false },
    ]);
  });
  it("conserve l’encaissé sans attendu et ignore les actions sans recette", () => {
    const result = buildClubIncome([post], [action({ revisedClubIncome: 0, actualClubIncome: 25 }), action({ id: "vide", revisedClubIncome: 0 })], context);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ expected: 0, collected: 25, outstanding: 0, state: "COLLECTED", overdue: false });
    expect(result.totals).toEqual({ expected: 0, collected: 25, outstanding: 0, overdue: 0, count: 1 });
  });
  it.each(["BUDGETED", "COMMITTED", "DONE", "UNBUDGETED"])("garde le budget révisé comme attendu pour %s", status => {
    expect(buildClubIncome([post], [action({ status })], context).lines[0].expected).toBe(100);
  });
  it.each([
    [null, 100, "PENDING", true], [0, 100, "PENDING", true], [20, 80, "PARTIAL", true],
    [99.49, 0.51, "PARTIAL", true], [99.5, 0.5, "COLLECTED", false], [99.51, 0.49, "COLLECTED", false],
    [100, 0, "COLLECTED", false], [120, 0, "COLLECTED", false],
  ] as const)("détermine l’état avec %s euros encaissés", (actualClubIncome, outstanding, state, overdue) => {
    expect(buildClubIncome([post], [action({ actualClubIncome })], context).lines[0]).toMatchObject({ outstanding, state, overdue });
  });
  it("arrondit le reste au centime avant d’appliquer le seuil", () => {
    expect(buildClubIncome([post], [action({ revisedClubIncome: 2.01, actualClubIncome: 1.004 })], context).lines[0].outstanding).toBe(1.01);
    expect(buildClubIncome([post], [action({ revisedClubIncome: 0.504 })], context).lines[0]).toMatchObject({ outstanding: 0.5, state: "COLLECTED", overdue: false });
  });
  it.each([
    [9, "2026", true], [10, "2026", false], [11, "2026", false], [null, "2026", false],
    [12, "2025", true], [null, "2025", false], [1, "2027", false],
  ] as const)("évalue le retard pour le mois %s de l’exercice %s", (plannedMonth, fiscalYearLabel, overdue) => {
    expect(buildClubIncome([post], [action({ plannedMonth })], { ...context, fiscalYearLabel }).lines[0].overdue).toBe(overdue);
  });
  it("ne marque aucun retard sans date de situation", () => {
    expect(buildClubIncome([post], [action()], { ...context, asOfDate: null }).lines[0].overdue).toBe(false);
  });
});
describe("totaux des recettes clubs", () => {
  it("arrondit les sommes, conserve l’ordre reçu et omet les postes sans ligne", () => {
    const other = { id: "post-c", code: "C", label: "Compétitions" };
    const result = buildClubIncome([other, { id: "vide", code: "A", label: "Commission" }, post], [
      action({ id: "b1", revisedClubIncome: 1.1, actualClubIncome: 0.1 }),
      action({ id: "c1", postId: other.id, postCode: other.code, revisedClubIncome: 30, actualClubIncome: 10, plannedMonth: 11 }),
      action({ id: "b2", revisedClubIncome: 2.2, actualClubIncome: 0.2 }),
      action({ id: "ignore", revisedClubIncome: 0 }),
    ], context);
    expect(result.lines.map(line => line.id)).toEqual(["b1", "c1", "b2"]);
    expect(result.posts).toEqual([
      { code: "C", label: "Compétitions", expected: 30, collected: 10, outstanding: 20, overdue: 0, count: 1 },
      { code: "B", label: "Stages", expected: 3.3, collected: 0.3, outstanding: 3, overdue: 3, count: 2 },
    ]);
    expect(result.totals).toEqual({ expected: 33.3, collected: 10.3, outstanding: 23, overdue: 3, count: 3 });
  });
  it("renvoie des totaux nuls sans ligne", () => {
    expect(buildClubIncome([post], [], context)).toEqual({ lines: [], posts: [], totals: { expected: 0, collected: 0, outstanding: 0, overdue: 0, count: 0 } });
  });
});
describe("vigilance des recettes clubs", () => {
  it("émet un point orange par ligne en retard dans l’ordre reçu", () => {
    const { lines } = buildClubIncome([post], [action({ revisedClubIncome: 1234.56 }), action({ id: "futur", plannedMonth: 12 }),
      action({ id: "seuil", actualClubIncome: 99.5 }), action({ id: "b", label: "Compétition", actualClubIncome: 20 })], context);
    expect(listClubIncomePoints(lines)).toEqual([
      { level: "orange", postCode: "B", actionId: "a", message: "Stage : 1 234,56 € de recettes clubs restent à encaisser alors que l’action est passée" },
      { level: "orange", postCode: "B", actionId: "b", message: "Compétition : 80 € de recettes clubs restent à encaisser alors que l’action est passée" },
    ]);
    expect(listClubIncomePoints([])).toEqual([]);
  });
});
