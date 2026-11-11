import { describe, expect, it } from "vitest";
import { analysisPeriods, buildBreakdown, buildCurve, buildPeriodTable, type AnalysisAction, type AnalysisFigures, type NatureAmount } from "../budget-analysis";
import { monthLabel, teamLabels } from "../budget-pilotage-labels";

const action = (plannedMonth: number | null, figures: AnalysisFigures, postId = "a", team: AnalysisAction["team"] = "SENIORS"): AnalysisAction => ({ plannedMonth, figures, postId, team });
const actions = [action(1, { budget: 100, actual: 20, remaining: 70, landing: 90 }),
  action(3, { budget: 200, actual: 50, remaining: 180, landing: 230 }, "a", "M20"),
  action(9, { budget: 300, actual: 60, remaining: 240, landing: 300 }, "b", "M17"),
  action(null, { budget: 120, actual: 30, remaining: 90, landing: 120 }, "b", "COMMISSION")];
const posts = [{ id: "b", code: "B", label: "Stages" }, { id: "a", code: "A", label: "Compétitions" }, { id: "c", code: "C", label: "Commission" }];
const months = analysisPeriods("month", "2026"), quarters = analysisPeriods("quarter", "2026");
const natures: NatureAmount[] = [{ name: "Transport", month: 1, amount: 60 }, { name: "Transport", month: 3, amount: 40 },
  { name: "Repas", month: 9, amount: 20 }, { name: "Hôtel", month: 3, amount: 100 }, { name: "Divers", month: 2, amount: 0 }];
const breakdown = { axis: "post" as const, measure: "landing" as const, posts, actions, natures, periods: quarters, cumulative: false };

describe("périodes d’analyse", () => {
  it("découpe les douze mois de l’année civile", () => {
    expect(months).toEqual(Array.from({ length: 12 }, (_, index) => ({ key: String(index + 1), label: monthLabel(index + 1), months: [index + 1] })));
  });
  it("nomme et ordonne les quatre trimestres", () => {
    expect(quarters).toEqual([{ key: "T1", label: "T1 (janv.–mars)", months: [1, 2, 3] }, { key: "T2", label: "T2 (avr.–juin)", months: [4, 5, 6] },
      { key: "T3", label: "T3 (juil.–sept.)", months: [7, 8, 9] }, { key: "T4", label: "T4 (oct.–déc.)", months: [10, 11, 12] }]);
  });
  it("place la fin de saison avant le début de la suivante", () => {
    expect(analysisPeriods("season", "2026")).toEqual([{ key: "END", label: "Fin de saison 25/26 (janv.–août)", months: [1, 2, 3, 4, 5, 6, 7, 8] },
      { key: "START", label: "Début de saison 26/27 (sept.–déc.)", months: [9, 10, 11, 12] }]);
    expect(analysisPeriods("season", "2027").map(period => period.label)).toEqual(["Fin de saison 26/27 (janv.–août)", "Début de saison 27/28 (sept.–déc.)"]);
  });
});
describe("tableau par période", () => {
  it("additionne les figures, la marge et les actions sans mois", () => {
    const table = buildPeriodTable(actions, quarters, false);
    expect(table.rows[0]).toEqual({ key: "T1", label: "T1 (janv.–mars)", budget: 300, actual: 70, remaining: 250, landing: 320, margin: -20, count: 2 });
    expect(table.rows[1]).toMatchObject({ budget: 0, actual: 0, remaining: 0, landing: 0, margin: 0, count: 0 });
    expect(table.undated).toEqual({ key: "NONE", label: "Sans mois", budget: 120, actual: 30, remaining: 90, landing: 120, margin: 0, count: 1 });
    expect(table.total).toEqual({ key: "TOTAL", label: "Total", budget: 720, actual: 160, remaining: 580, landing: 740, margin: -20, count: 4 });
    expect(buildPeriodTable(actions, analysisPeriods("season", "2026"), false).rows.map(row => row.budget)).toEqual([300, 300]);
  });
  it("cumule aussi les comptes sans changer les lignes Sans mois et Total", () => {
    const plain = buildPeriodTable(actions, quarters, false), cumulative = buildPeriodTable(actions, quarters, true);
    expect(cumulative.rows.map(row => row.count)).toEqual([2, 2, 3, 3]);
    expect(cumulative.rows.map(row => row.landing)).toEqual([320, 320, 620, 620]);
    expect(cumulative.rows[3]).toMatchObject({ budget: 600, actual: 130, remaining: 490, landing: 620, margin: -20 });
    expect(cumulative.undated).toEqual(plain.undated); expect(cumulative.total).toEqual(plain.total);
  });
  it("arrondit seulement après les sommes et le cumul", () => {
    const figures = { budget: 0.004, actual: 0.004, remaining: 0.004, landing: 0.008 };
    const table = buildPeriodTable([action(1, figures), action(2, figures)], months, true);
    expect(table.rows[0]).toMatchObject({ budget: 0, landing: 0.01 });
    expect(table.rows[1]).toMatchObject({ budget: 0.01, actual: 0.01, remaining: 0.01, landing: 0.02, margin: -0.01 });
    expect(buildPeriodTable([action(1, figures), action(1, figures)], months, false).rows[0].budget).toBe(0.01);
  });
  it("garde des lignes à zéro pour un exercice vide", () => {
    const table = buildPeriodTable([], months, true);
    expect(table.rows).toHaveLength(12);
    expect(table.total).toMatchObject({ budget: 0, actual: 0, remaining: 0, landing: 0, margin: 0, count: 0 });
    expect(table.undated.count).toBe(0);
  });
});
describe("répartitions", () => {
  it("garde l’ordre des postes et les lignes à zéro", () => {
    const result = buildBreakdown(breakdown);
    expect(result.rows).toEqual([{ key: "b", label: "B — Stages", cells: [0, 0, 300, 0], undated: 120, total: 420 },
      { key: "a", label: "A — Compétitions", cells: [320, 0, 0, 0], undated: 0, total: 320 },
      { key: "c", label: "C — Commission", cells: [0, 0, 0, 0], undated: 0, total: 0 }]);
    expect(result.totals).toEqual({ cells: [320, 0, 300, 0], undated: 120, total: 740 });
    expect(buildBreakdown({ ...breakdown, measure: "budget" }).totals).toEqual({ cells: [300, 0, 300, 0], undated: 120, total: 720 });
    expect(buildBreakdown({ ...breakdown, measure: "actual" }).totals).toEqual({ cells: [70, 0, 60, 0], undated: 30, total: 160 });
  });
  it("limite le total aux périodes demandées et aux actions sans mois", () => {
    const result = buildBreakdown({ ...breakdown, periods: quarters.slice(0, 1) });
    expect(result.rows[0]).toMatchObject({ cells: [0], undated: 120, total: 120 });
    expect(result.totals).toEqual({ cells: [320], undated: 120, total: 440 });
  });
  it("cumule les cellules de chaque poste et les totaux par colonne", () => {
    const result = buildBreakdown({ ...breakdown, cumulative: true });
    expect(result.rows[0]).toMatchObject({ cells: [0, 0, 300, 300], undated: 120, total: 420 });
    expect(result.rows[1]).toMatchObject({ cells: [320, 320, 320, 320], total: 320 });
    expect(result.totals).toEqual({ cells: [320, 320, 620, 620], undated: 120, total: 740 });
  });
  it("range toutes les équipes selon les libellés, y compris celles sans action", () => {
    const result = buildBreakdown({ ...breakdown, axis: "team", measure: "actual" });
    expect(result.rows.map(row => [row.key, row.label])).toEqual(Object.entries(teamLabels));
    expect(result.rows.map(row => row.total)).toEqual([20, 50, 60, 0, 30]);
    expect(result.rows[3]).toMatchObject({ cells: [0, 0, 0, 0], undated: 0, total: 0 });
    expect(result.totals).toEqual({ cells: [70, 0, 60, 0], undated: 30, total: 160 });
    expect(buildBreakdown({ ...breakdown, axis: "team", measure: "actual", cumulative: true }).totals).toEqual({ cells: [70, 70, 130, 130], undated: 30, total: 160 });
  });
  it("classe les natures par total puis nom et ignore la mesure", () => {
    const result = buildBreakdown({ ...breakdown, axis: "nature" });
    expect(result.rows.map(row => row.label)).toEqual(["Hôtel", "Transport", "Repas", "Divers"]);
    expect(result.rows[1]).toEqual({ key: "Transport", label: "Transport", cells: [100, 0, 0, 0], undated: 0, total: 100 });
    expect(result.totals).toEqual({ cells: [200, 0, 20, 0], undated: 0, total: 220 });
    expect(buildBreakdown({ ...breakdown, axis: "nature", measure: "budget" })).toEqual(result);
    expect(buildBreakdown({ ...breakdown, axis: "nature", measure: "actual" })).toEqual(result);
    const cumulative = buildBreakdown({ ...breakdown, axis: "nature", cumulative: true });
    expect(cumulative.rows[1]).toMatchObject({ cells: [100, 100, 100, 100], undated: 0, total: 100 });
    expect(cumulative.totals).toEqual({ cells: [200, 200, 220, 220], undated: 0, total: 220 });
    expect(buildBreakdown({ ...breakdown, axis: "nature", natures: [] })).toEqual({ rows: [], totals: { cells: [0, 0, 0, 0], undated: 0, total: 0 } });
  });
  it("arrondit les cellules et les totaux à partir des montants non arrondis", () => {
    const result = buildBreakdown({ ...breakdown, axis: "nature", periods: months, cumulative: true,
      natures: [{ name: "A", month: 1, amount: 0.004 }, { name: "A", month: 2, amount: 0.004 }, { name: "B", month: 1, amount: 0.004 }] });
    expect(result.rows[0].cells.slice(0, 2)).toEqual([0, 0.01]);
    expect(result.totals.cells.slice(0, 2)).toEqual([0.01, 0.01]);
    expect(result.totals.total).toBe(0.01);
  });
});
describe("courbe cumulée", () => {
  it("répartit les actions sans mois et atteint le réalisé total au mois connu", () => {
    const points = buildCurve(actions, { asOfDate: "2026-03-20", fiscalYearLabel: "2026" });
    expect(points.map(point => point.month)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    expect(points[0]).toEqual({ month: 1, budget: 110, landing: 100, actual: 30 });
    expect(points[1]).toEqual({ month: 2, budget: 120, landing: 110, actual: 40 });
    expect(points[2]).toEqual({ month: 3, budget: 330, landing: 350, actual: 160 });
    expect(points.slice(3).every(point => point.actual === null)).toBe(true);
    expect(points[8]).toMatchObject({ budget: 690, landing: 710 });
    expect(points[11]).toEqual({ month: 12, budget: 720, landing: 740, actual: null });
  });
  it("montre tout le réalisé pour un exercice passé et aucun pour un exercice à venir", () => {
    const past = buildCurve(actions, { asOfDate: new Date("2027-01-01"), fiscalYearLabel: "2026" });
    expect(past[0].actual).toBe(22.5);
    expect(past.every(point => point.actual !== null)).toBe(true);
    expect(past[11]).toEqual({ month: 12, budget: 720, landing: 740, actual: 160 });
    const future = buildCurve(actions, { asOfDate: "2025-12-31", fiscalYearLabel: "2026" });
    expect(future.every(point => point.actual === null)).toBe(true);
    expect(future[11]).toMatchObject({ budget: 720, landing: 740 });
  });
  it("utilise le mois UTC et ramène aussi les réalisations futures au dernier mois connu", () => {
    const points = buildCurve(actions, { asOfDate: "2026-03-01T00:30:00+01:00", fiscalYearLabel: "2026" });
    expect(points[0].actual).toBe(35); expect(points[1].actual).toBe(160); expect(points[2].actual).toBeNull();
    expect(buildCurve(actions, { asOfDate: "2026-01-01", fiscalYearLabel: "2026" })[0].actual).toBe(160);
  });
  it("arrondit les points sans accumuler d’arrondis et termine aux totaux en décembre", () => {
    const points = buildCurve([action(null, { budget: 100, actual: 10, remaining: 90, landing: 100 })], { asOfDate: "2026-03-01", fiscalYearLabel: "2026" });
    expect(points.slice(0, 3).map(point => point.budget)).toEqual([8.33, 16.67, 25]);
    expect(points.slice(0, 3).map(point => point.actual)).toEqual([3.33, 6.67, 10]);
    expect(points[11].budget).toBe(100);
    const december = buildCurve(actions, { asOfDate: "2026-12-01", fiscalYearLabel: "2026" })[11];
    expect(december).toEqual({ month: 12, budget: 720, landing: 740, actual: 160 });
  });
  it("distingue un réalisé nul d’un mois inconnu pour un exercice vide", () => {
    const points = buildCurve([], { asOfDate: "2026-01-01", fiscalYearLabel: "2026" });
    expect(points[0]).toEqual({ month: 1, budget: 0, landing: 0, actual: 0 });
    expect(points[1]).toEqual({ month: 2, budget: 0, landing: 0, actual: null });
  });
});
