import type { BudgetActionStatus, BudgetPostKind } from "@prisma/client";
import { isPlannedMonthPast } from "./budget-date";
import { roundAmount } from "./budget-matrix";

export type PilotageAction = {
  id: string; postId: string; label: string; plannedMonth: number | null; status: BudgetActionStatus;
  includedInBudget: boolean; proposedSaving: boolean; settled: boolean | null;
  initialFederation: number; revisedFederation: number; adjustmentFederation: number; estimatedFederation: number | null;
  actualFederation: number | null; revisedGross: number; revisedClubIncome: number;
  actualGross: number | null; actualClubIncome: number | null;
};
export type PilotagePost = { id: string; code: string; label: string; kind: BudgetPostKind };
export type ActionFigures = { budget: number; actual: number; landing: number; variance: number; remaining: number };
export type Flag = "green" | "orange" | "red";
const statuses: BudgetActionStatus[] = ["OPTION", "BUDGETED", "COMMITTED", "DONE", "CANCELLED", "UNBUDGETED"];
export const inBudget = (action: Pick<PilotageAction, "includedInBudget" | "status">) =>
  action.includedInBudget && action.status !== "OPTION" && action.status !== "UNBUDGETED";
export type SituationContext = { asOfDate: Date | null; fiscalYearLabel: string };
export function isActionSettled(action: Pick<PilotageAction, "settled" | "status" | "label" | "plannedMonth">,
  context?: SituationContext): boolean {
  if (action.settled !== null) return action.settled;
  if (action.status !== "DONE") return false;
  if (/\bfait\b/i.test(action.label.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) return true;
  if (action.plannedMonth === null || !context?.asOfDate) return false;
  const elapsedMonths = (context.asOfDate.getUTCFullYear() - Number(context.fiscalYearLabel)) * 12 +
    context.asOfDate.getUTCMonth() + 1 - action.plannedMonth;
  return elapsedMonths >= 2;
}
export function computeActionFigures(action: Pick<PilotageAction, "status" | "includedInBudget" | "revisedFederation" | "adjustmentFederation" | "actualFederation" | "estimatedFederation" | "settled" | "label" | "plannedMonth">,
  context?: SituationContext): ActionFigures {
  const budget = action.status === "OPTION" ? 0 : (inBudget(action) ? action.revisedFederation : 0) + action.adjustmentFederation;
  const actual = action.actualFederation ?? 0;
  const remaining = isActionSettled(action, context) || action.status === "CANCELLED" || action.status === "OPTION"
    ? 0 : Math.max((action.estimatedFederation ?? budget) - actual, 0);
  const landing = actual + remaining;
  return { budget: roundAmount(budget), actual: roundAmount(actual), landing: roundAmount(landing),
    variance: roundAmount(actual - budget), remaining: roundAmount(remaining) };
}
const flagFor = (budget: number, actual: number, landing: number): Flag =>
  actual > budget + 0.5 ? "red" : landing > budget + 0.5 ? "orange" : "green";
export type SummaryTotals = {
  budget: number; adjustments: number; initialBudget: number; actual: number; landing: number; remaining: number; margin: number;
  flag: Flag; options: number; unbudgeted: number; proposedSavings: number;
  gross: { budget: number; actual: number }; clubIncome: { budget: number; actual: number };
  counts: Record<BudgetActionStatus, number>;
};
export type PostSummary = Pick<PilotagePost, "code" | "label" | "kind"> & SummaryTotals;
export type FiscalYearSummary = {
  fiscalYearLabel: string; posts: PostSummary[]; totals: SummaryTotals; restitution: number; globalMargin: number; flag: Flag;
};
function aggregate(actions: PilotageAction[], context?: SituationContext): SummaryTotals {
  const sum = (get: (action: PilotageAction) => number) => roundAmount(actions.reduce((total, action) => total + get(action), 0));
  const budget = sum(action => computeActionFigures(action, context).budget);
  const actual = sum(action => computeActionFigures(action, context).actual);
  const landing = sum(action => computeActionFigures(action, context).landing);
  return {
    budget, adjustments: sum(action => action.adjustmentFederation), initialBudget: sum(action => inBudget(action) ? action.initialFederation : 0), actual, landing,
    remaining: sum(action => computeActionFigures(action, context).remaining), margin: roundAmount(budget - landing), flag: flagFor(budget, actual, landing),
    options: sum(action => action.status === "OPTION" ? action.revisedFederation : 0),
    unbudgeted: sum(action => action.status === "UNBUDGETED" ? computeActionFigures(action, context).landing : 0),
    proposedSavings: sum(action => action.proposedSaving && action.status !== "CANCELLED" ? action.revisedFederation : 0),
    gross: { budget: sum(action => inBudget(action) ? action.revisedGross : 0), actual: sum(action => action.actualGross ?? 0) },
    clubIncome: { budget: sum(action => inBudget(action) ? action.revisedClubIncome : 0), actual: sum(action => action.actualClubIncome ?? 0) },
    counts: Object.fromEntries(statuses.map(status => [status, actions.filter(action => action.status === status).length])) as Record<BudgetActionStatus, number>,
  };
}
export function computePostSummary(post: PilotagePost, actions: PilotageAction[], context?: SituationContext): PostSummary {
  return { code: post.code, label: post.label, kind: post.kind, ...aggregate(actions.filter(action => action.postId === post.id), context) };
}
export function computeFiscalYearSummary({ fiscalYear, posts, actions, asOfDate }: {
  fiscalYear: { label: string; restitutionAmount: number }; posts: PilotagePost[]; actions: PilotageAction[]; asOfDate?: Date | null;
}): FiscalYearSummary {
  const context = { asOfDate: asOfDate ?? null, fiscalYearLabel: fiscalYear.label };
  const totals = aggregate(actions, context);
  const restitution = fiscalYear.restitutionAmount;
  return { fiscalYearLabel: fiscalYear.label, posts: posts.map(post => computePostSummary(post, actions, context)),
    totals, restitution, globalMargin: roundAmount(totals.budget - totals.landing - restitution),
    flag: flagFor(totals.budget, totals.actual, totals.landing + restitution) };
}
export type VigilancePoint = { level: "red" | "orange" | "info"; postCode: string; actionId?: string; message: string };
const money = (amount: number) => amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 }).replace(/[\u00a0\u202f]/g, " ") + " €";
export function listVigilancePoints(summary: FiscalYearSummary, actions: Array<PilotageAction & { postCode: string }>,
  context?: { asOfDate: Date | null; fiscalYearLabel: string }): VigilancePoint[] {
  const points: VigilancePoint[] = [];
  for (const action of actions) {
    const post = summary.posts.find(post => post.code === action.postCode);
    if (!post) continue;
    const figures = computeActionFigures(action, context);
    const add = (level: VigilancePoint["level"], message: string) => points.push({ level, postCode: action.postCode, actionId: action.id, message: action.label + " : " + message });
    if (context && action.status === "BUDGETED" && action.actualFederation === null && action.actualGross === null &&
      post.kind !== "OPERATING" && isPlannedMonthPast(action.plannedMonth, context.asOfDate, context.fiscalYearLabel)) {
      add("info", "événement passé sans dépense enregistrée — annulé ou pas encore facturé ? (" + money(figures.budget) + " budgétés)");
    }
    if (figures.actual > figures.budget) add("red", "dépassement réalisé de " + money(figures.actual - figures.budget));
    else if (action.status === "UNBUDGETED" && figures.landing > 0) add("orange", "action hors budget, atterrissage de " + money(figures.landing));
    else if (figures.landing > figures.budget) add("orange", "atterrissage supérieur au budget de " + money(figures.landing - figures.budget));
    if (action.proposedSaving && action.status !== "CANCELLED") add("info", "économie proposée à valider de " + money(action.revisedFederation));
    if (action.status === "OPTION" && !action.includedInBudget) add("info", "option non budgétée de " + money(action.revisedFederation));
  }
  return points;
}
export function buildMonthlyReportText(summary: FiscalYearSummary, vigilance: VigilancePoint[], asOfDate: Date): string {
  const month = asOfDate.toLocaleString("fr-FR", { month: "long", timeZone: "UTC" });
  const lines = ["Point budgétaire COMEH à fin " + month + " " + asOfDate.getUTCFullYear(), ""];
  summary.posts.forEach((post, index) => {
    const budgetText = post.clubIncome.budget > 0
      ? money(post.gross.budget) + " dont " + money(post.clubIncome.budget) + " de contributions club/athlète et " + money(post.budget) + " de part FFE"
      : money(post.budget);
    const percent = post.budget === 0 ? "—" : (post.actual / post.budget * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
    lines.push((index + 1) + ". " + post.label,
      "• Budget " + summary.fiscalYearLabel + " : " + budgetText,
      ...(post.adjustments > 0 ? ["  • dont " + money(post.adjustments) + " de rallonge / ajustement"] : []),
      "• Réalisé à date : " + money(post.actual) + " (" + percent + " % du budget)",
      "• Reste à venir : " + money(post.remaining),
      "• Atterrissage (total) : " + money(post.landing) + " → " + (post.margin >= 0 ? "marge" : "dépassement") + " de " + money(Math.abs(post.margin)),
      ...vigilance.filter(point => point.postCode === post.code).map(point => "• " + point.message), "");
  });
  lines.push("Synthèse", "Réalisé : " + money(summary.totals.actual) + " | Reste à venir : " + money(summary.totals.remaining) +
    " | Atterrissage (total) : " + money(summary.totals.landing), "Marge globale : " + money(summary.globalMargin));
  if (summary.restitution > 0) lines.push("Restitution fédé : " + money(summary.restitution));
  return lines.join("\n");
}

export function buildPilotageHeadline(summary: FiscalYearSummary, asOfDate: Date): string {
  const { totals } = summary;
  const date = asOfDate.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const percent = totals.budget ? Math.round(totals.actual / totals.budget * 100) + " %" : "budget nul";
  const gap = (margin: number) => money(Math.abs(margin)) + (margin >= 0 ? " en dessous du budget" : " au-dessus du budget");
  return "Au " + date + " : " + money(totals.actual) + (totals.actual > 1 ? " dépensés sur " : " dépensé sur ") + money(totals.budget) + " de budget FFE (" + percent + "). " +
    "Il reste " + money(totals.remaining) + " d’actions à venir : le budget devrait finir à " + money(totals.landing) + ", soit " +
    gap(totals.margin) + (summary.restitution ? " (" + gap(summary.globalMargin) + " après restitution)" : "") + ".";
}
