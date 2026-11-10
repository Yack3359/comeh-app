import { describe, expect, it } from "vitest";
import { buildConstruction, buildPreparationLines, computePreparationProgress, countLabel, suggestFromPrevious, teamOf, voteOutcome, type PreparationLine } from "../budget-preparation";
import { buildPilotageHeadline, computeFiscalYearSummary } from "../budget-pilotage";
import { pilotageAction, post } from "./budget-fixtures";

const source = { label: "Doha", fiscalYearLabel: "2026", revisedGross: 30500, revisedFederation: 19500, revisedClubIncome: 11000,
  actualGross: 20657, actualFederation: 13640, actualClubIncome: 7017 };
const line = (overrides: Partial<PreparationLine> = {}): PreparationLine => ({ ...pilotageAction(), postId: post.id,
  fencingCategories: ["M17"], proposalStatus: "PROPOSED", amountsConfirmed: false, postKind: "COMPETITION", ...overrides });
const context = { deadline: new Date("2026-12-15"), phase: "PREPARATION" as const, today: new Date("2026-12-01") };
describe("préparation du budget", () => {
  it.each([[[], "COMPETITION", "COMMUN"], [[], "OPERATING", "COMMISSION"], [["SENIOR", "U23"], "COMPETITION", "SENIORS"],
    [["U23"], "COMPETITION", "M20"], [["M20", "U23"], "COMPETITION", "M20"], [["SENIOR"], "COMPETITION", "SENIORS"],
    [["SENIOR", "M20"], "COMPETITION", "COMMUN"], [["M20"], "TRAINING_CAMP", "M20"], [["M17", "M15", "M13"], "COMPETITION", "M17"], [["M20", "M17"], "COMPETITION", "COMMUN"],
    [["M20"], "OPERATING", "M20"], [["M20", "M17"], "OPERATING", "COMMISSION"]] as const)("classe %j / %s", (categories, kind, expected) => {
    expect(teamOf({ fencingCategories: categories }, kind)).toBe(expected);
  });
  it("propose Doha à partir du réalisé et partage la prise en charge", () => {
    expect(suggestFromPrevious(source)).toEqual({ gross: 21700, federation: 10900, clubIncome: 10800, basis: "réalisé 2026 + 5 %" });
    expect(suggestFromPrevious({ ...source, revisedClubIncome: 0, actualClubIncome: 0 }).federation).toBe(21700);
    expect(suggestFromPrevious({ ...source, actualGross: null, actualFederation: null })).toMatchObject({ gross: 32100, basis: "budget 2026 + 5 %" });
    expect(suggestFromPrevious({ ...source, actualGross: 0 })).toMatchObject({ gross: 0, federation: 0 });
    expect(suggestFromPrevious({ ...source, actualGross: null }, 10).gross).toBe(15100);
  });
  it("reconduit les montants révisés et les postes, sans les actions annulées", () => {
    const previous = { ...line(), plannedMonth: 2, fencingCategories: ["M17"] as Array<"M17">, ...source, id: "doha" };
    const result = buildPreparationLines([{ ...post, label: "Compétitions 2026", fiscalYearLabel: "2026" }], [previous, { ...previous, id: "cancelled", status: "CANCELLED" }]);
    expect(result.posts[0].label).toBe("Compétitions 2027");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ sourceActionId: "doha", postCode: post.code, revisedFederation: 19500, previousYearAmount: 19500,
      amountsConfirmed: false, proposalStatus: "PROPOSED", plannedMonth: 2, fencingCategories: ["M17"] });
  });
  it("calcule les compteurs, hypothèses, étapes et échéances", () => {
    const lines = [line(), line({ proposalStatus: "VALIDATED", amountsConfirmed: true }), line({ proposalStatus: "ARBITRATION" }), line({ proposalStatus: "REJECTED" })];
    const progress = computePreparationProgress(lines, context);
    expect(progress).toMatchObject({ total: 4, retained: 1, pending: 1, arbitration: 1, rejected: 1, unpriced: 2, percent: 61 });
    expect(progress.amounts.high).toBe(3 * lines[0].revisedFederation);
    expect(progress.amounts.retained).toBe(lines[0].revisedFederation);
    expect(progress.byTeam.find(item => item.team === "M17")?.kinds.find(item => item.kind === "COMPETITION")?.total).toBe(4);
    expect(progress.steps.filter(step => step.current).map(step => step.key)).toEqual(["confirmed"]);
    expect(progress.todo[0]).toContain("M17 : 1 ligne à confirmer, 2 montants à chiffrer");
    expect(progress.headline).toContain("14 jours restants");
    expect(computePreparationProgress([], context).percent).toBe(0);
    expect(computePreparationProgress(lines, { ...context, phase: "EXECUTION" }).percent).toBe(100);
    expect(computePreparationProgress(lines, { ...context, today: new Date("2026-12-16") }).headline).toContain("dépassée de 1 jour");
    expect(computePreparationProgress([line({ proposalStatus: "REJECTED" })], context).percent).toBe(100);
  });
  it.each([0, 1, 3])("accorde les compteurs à %i", count => {
    expect(countLabel(count, "ligne", "lignes")).toBe(count + (count > 1 ? " lignes" : " ligne"));
  });
  it.each([1, 3])("accorde la phrase et les tâches pour %i occurrence(s)", count => {
    const lines = Array.from({ length: count }, () => [line(), line({ proposalStatus: "ARBITRATION", amountsConfirmed: true })]).flat();
    const progress = computePreparationProgress(lines, { ...context, today: new Date("2026-12-14") });
    const suffix = count > 1 ? "s" : "";
    expect(progress.headline).toContain(count + " ligne" + suffix + " à confirmer, " + count + " montant" + suffix + " à chiffrer et " + count + " arbitrage" + suffix + " à rendre.");
    expect(progress.headline).toContain("1 jour restant");
    expect(progress.todo).toEqual(["M17 : " + count + " ligne" + suffix + " à confirmer, " + count + " montant" + suffix + " à chiffrer, " + count + " ligne" + suffix + " à arbitrer"]);
    expect(progress.steps[0].detail).toBe(2 * count + " lignes");
    expect(computePreparationProgress([line()], context).steps[0].detail).toBe("1 ligne");
  });
  it("construit le budget retenu ou haut, et le suivi selon inBudget", () => {
    const lines = [line({ proposalStatus: "VALIDATED", source }), line(), line({ proposalStatus: "REJECTED" })];
    const previous = { [post.code]: { budget: 19500, actual: 13640 } };
    const retained = buildConstruction([post], lines, previous, { includePending: false });
    expect(retained.posts[0].lines).toHaveLength(1);
    expect(retained.totals.previousActual).toBe(13640);
    expect(retained.totals.variance).toBe(lines[0].revisedFederation - 19500);
    expect(retained.posts[0].lines[0].previousBudget).toBe(19500);
    expect(buildConstruction([post], lines, previous, { includePending: true }).posts[0].lines).toHaveLength(2);
    const execution = buildConstruction([post], [line({ status: "OPTION", includedInBudget: false, actualFederation: 50 }),
      line({ status: "BUDGETED", includedInBudget: true, actualFederation: 100 })], previous, { includePending: false, phase: "EXECUTION" });
    expect(execution.posts[0].lines).toHaveLength(1);
    expect(execution.totals.actual.federation).toBe(150);
    expect(buildConstruction([], [], {}, { includePending: false }).totals.federationPercent).toBe(0);
  });
  it.each(["VALIDATED", "PROPOSED", "ARBITRATION", "REJECTED"] as const)("convertit %s au vote", status => {
    expect(voteOutcome(status, source)).toEqual({ status: status === "VALIDATED" ? "BUDGETED" : status === "REJECTED" ? "CANCELLED" : "OPTION",
      includedInBudget: status === "VALIDATED", initialGross: status === "VALIDATED" ? 30500 : 0,
      initialClubIncome: status === "VALIDATED" ? 11000 : 0, initialFederation: status === "VALIDATED" ? 19500 : 0 });
  });
  it("explique les marges et la restitution en français", () => {
    const summary = computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: 5000 }, posts: [post], actions: [pilotageAction()] });
    Object.assign(summary.totals, { budget: 236460, actual: 145016, remaining: 98221, landing: 243237, margin: -6777 });
    summary.globalMargin = -11777;
    const text = buildPilotageHeadline(summary, new Date("2026-10-25"));
    expect(text).toContain("145 016 € dépensés sur 236 460 € de budget FFE (61 %)");
    expect(text).toContain("6 777 € au-dessus du budget");
    expect(text).toContain("11 777 € au-dessus du budget après restitution");
    summary.totals.actual = 1;
    expect(buildPilotageHeadline(summary, new Date("2026-10-25"))).toContain("1 € dépensé sur");
    summary.totals.margin = 100;
    expect(buildPilotageHeadline(summary, new Date("2026-10-25"))).toContain("100 € en dessous du budget");
  });
});
