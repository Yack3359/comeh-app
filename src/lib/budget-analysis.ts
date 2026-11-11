import { roundAmount } from "./budget-amount";
import { seasonLabelsOf } from "./budget-season";
import { monthLabel, teamLabels } from "./budget-pilotage-labels";

export type Granularity = "month" | "quarter" | "season";
export type Axis = "post" | "team" | "nature";
export type Measure = "budget" | "actual" | "landing";
export type AnalysisFigures = { budget: number; actual: number; remaining: number; landing: number };
export type AnalysisAction = { postId: string; team: keyof typeof teamLabels; plannedMonth: number | null; figures: AnalysisFigures };
export type NatureAmount = { name: string; month: number; amount: number };
export type Period = { key: string; label: string; months: number[] };
export type PeriodRow = AnalysisFigures & { key: string; label: string; margin: number; count: number };

export function analysisPeriods(granularity: Granularity, fiscalYearLabel: string): Period[] {
  if (granularity === "month") return Array.from({ length: 12 }, (_, index) => ({ key: String(index + 1), label: monthLabel(index + 1), months: [index + 1] }));
  if (granularity === "quarter") return ["T1 (janv.–mars)", "T2 (avr.–juin)", "T3 (juil.–sept.)", "T4 (oct.–déc.)"].map((label, index) => ({ key: "T" + (index + 1), label, months: [1, 2, 3].map(month => month + index * 3) }));
  const labels = seasonLabelsOf(fiscalYearLabel);
  return [{ key: "END", label: "Fin de saison " + labels.END + " (janv.–août)", months: [1, 2, 3, 4, 5, 6, 7, 8] },
    { key: "START", label: "Début de saison " + labels.START + " (sept.–déc.)", months: [9, 10, 11, 12] }];
}
export function buildPeriodTable(actions: Array<Pick<AnalysisAction, "plannedMonth" | "figures">>, periods: Period[], cumulative: boolean): { rows: PeriodRow[]; undated: PeriodRow; total: PeriodRow } {
  const row = (key: string, label: string, selected: typeof actions): PeriodRow => {
    const sum = (field: keyof AnalysisFigures) => selected.reduce((total, action) => total + action.figures[field], 0);
    const budget = sum("budget"), landing = sum("landing");
    return { key, label, budget: roundAmount(budget), actual: roundAmount(sum("actual")), remaining: roundAmount(sum("remaining")), landing: roundAmount(landing), margin: roundAmount(budget - landing), count: selected.length };
  };
  let running: typeof actions = [];
  const rows = periods.map(period => {
    const selected = actions.filter(action => action.plannedMonth !== null && period.months.includes(action.plannedMonth));
    running = [...running, ...selected];
    return row(period.key, period.label, cumulative ? running : selected);
  });
  return { rows, undated: row("NONE", "Sans mois", actions.filter(action => action.plannedMonth === null)), total: row("TOTAL", "Total", actions) };
}
export function buildBreakdown({ axis, measure, posts, actions, natures, periods, cumulative }: {
  axis: Axis; measure: Measure; posts: Array<{ id: string; code: string; label: string }>; actions: AnalysisAction[]; natures: NatureAmount[]; periods: Period[]; cumulative: boolean;
}) {
  const groups = axis === "post" ? posts.map(post => ({ key: post.id, label: post.code + " — " + post.label })) : axis === "team" ?
    Object.entries(teamLabels).map(([key, label]) => ({ key, label })) : Array.from(new Set(natures.map(item => item.name))).map(name => ({ key: name, label: name }));
  const rows = groups.map(group => {
    const amounts = axis === "nature" ? natures.filter(item => item.name === group.key).map(item => ({ month: item.month, amount: item.amount })) :
      actions.filter(action => (axis === "post" ? action.postId : action.team) === group.key).map(action => ({ month: action.plannedMonth, amount: action.figures[measure] }));
    const sum = (selected: typeof amounts) => selected.reduce((total, item) => total + item.amount, 0);
    let running = 0;
    const cells = periods.map(period => {
      const value = sum(amounts.filter(item => item.month !== null && period.months.includes(item.month)));
      running += value;
      return cumulative ? running : value;
    });
    const undated = sum(amounts.filter(item => item.month === null));
    return { ...group, cells, undated, total: running + undated };
  });
  if (axis === "nature") rows.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "fr"));
  const totals = { cells: periods.map((_, index) => rows.reduce((total, row) => total + row.cells[index], 0)),
    undated: rows.reduce((total, row) => total + row.undated, 0), total: rows.reduce((total, row) => total + row.total, 0) };
  const rounded = (row: typeof totals) => ({ cells: row.cells.map(roundAmount), undated: roundAmount(row.undated), total: roundAmount(row.total) });
  return { rows: rows.map(row => ({ key: row.key, label: row.label, ...rounded(row) })), totals: rounded(totals) };
}
export function buildCurve(actions: Array<Pick<AnalysisAction, "plannedMonth" | "figures">>, { asOfDate, fiscalYearLabel }: { asOfDate: Date | string; fiscalYearLabel: string }): Array<{ month: number; budget: number; landing: number; actual: number | null }> {
  const date = new Date(asOfDate), year = Number(fiscalYearLabel);
  const asOfMonth = date.getUTCFullYear() < year ? 0 : date.getUTCFullYear() > year ? 12 : date.getUTCMonth() + 1;
  const sum = (selected: typeof actions, measure: Measure) => selected.reduce((total, action) => total + action.figures[measure], 0);
  const undated = actions.filter(action => action.plannedMonth === null);
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1, selected = actions.filter(action => action.plannedMonth !== null && action.plannedMonth <= month);
    const cumulative = (measure: Measure) => month === 12 ? sum(actions, measure) : sum(selected, measure) + sum(undated, measure) * month / 12;
    const actual = month > asOfMonth ? null : month === asOfMonth ? sum(actions, "actual") : sum(selected, "actual") + sum(undated, "actual") * month / asOfMonth;
    return { month, budget: roundAmount(cumulative("budget")), landing: roundAmount(cumulative("landing")), actual: actual === null ? null : roundAmount(actual) };
  });
}
