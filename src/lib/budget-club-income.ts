import { roundAmount } from "./budget-amount";
import { isPlannedMonthPast } from "./budget-date";
import { money, type VigilancePoint } from "./budget-pilotage";

export type ClubIncomeState = "PENDING" | "PARTIAL" | "COLLECTED";
export type ClubIncomeLine = { id: string; label: string; postId: string; postCode: string; plannedMonth: number | null;
  expected: number; collected: number; outstanding: number; state: ClubIncomeState; overdue: boolean };
export type ClubIncomeTotals = { expected: number; collected: number; outstanding: number; overdue: number; count: number };
export function buildClubIncome(posts: Array<{ id: string; code: string; label: string }>,
  actions: Array<{ id: string; label: string; postId: string; postCode: string; plannedMonth: number | null; status: string; revisedClubIncome: number; actualClubIncome: number | null }>,
  context: { asOfDate: Date | null; fiscalYearLabel: string }):
  { lines: ClubIncomeLine[]; posts: Array<ClubIncomeTotals & { code: string; label: string }>; totals: ClubIncomeTotals } {
  const lines: ClubIncomeLine[] = actions.flatMap(action => {
    const expected = action.status === "CANCELLED" || action.status === "OPTION" ? 0 : action.revisedClubIncome;
    const collected = action.actualClubIncome ?? 0;
    if (expected <= 0 && collected <= 0) return [];
    const outstanding = roundAmount(Math.max(expected - collected, 0));
    const state: ClubIncomeState = outstanding <= 0.5 ? "COLLECTED" : collected > 0 ? "PARTIAL" : "PENDING";
    return [{ id: action.id, label: action.label, postId: action.postId, postCode: action.postCode, plannedMonth: action.plannedMonth,
      expected, collected, outstanding, state, overdue: outstanding > 0.5 && isPlannedMonthPast(action.plannedMonth, context.asOfDate, context.fiscalYearLabel) }];
  });
  const aggregate = (items: ClubIncomeLine[]): ClubIncomeTotals => {
    const sum = (get: (line: ClubIncomeLine) => number) => roundAmount(items.reduce((total, line) => total + get(line), 0));
    return { expected: sum(line => line.expected), collected: sum(line => line.collected), outstanding: sum(line => line.outstanding),
      overdue: sum(line => line.overdue ? line.outstanding : 0), count: items.length };
  };
  return { lines, posts: posts.flatMap(post => {
    const items = lines.filter(line => line.postId === post.id);
    return items.length ? [{ code: post.code, label: post.label, ...aggregate(items) }] : [];
  }), totals: aggregate(lines) };
}
export function listClubIncomePoints(lines: ClubIncomeLine[]): VigilancePoint[] {
  return lines.filter(line => line.overdue).map(line => ({ level: "orange", postCode: line.postCode, actionId: line.id,
    message: line.label + " : " + money(line.outstanding) + " de recettes clubs restent à encaisser alors que l’action est passée" }));
}
