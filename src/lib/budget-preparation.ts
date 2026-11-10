import { seasonLabelsOf, seasonPartOf, type SeasonPart } from "./budget-season";
import { inBudget } from "./budget-pilotage";
import type { FencingCategoryValue } from "./budget-matrix";
import { roundAmount } from "./budget-matrix";
import { countLabel, teamLabels } from "./budget-pilotage-labels";

export type Team = "SENIORS" | "M20" | "M17" | "COMMUN" | "COMMISSION";
export type ProposalStatus = "PROPOSED" | "VALIDATED" | "ARBITRATION" | "REJECTED";
export type Phase = "PREPARATION" | "EXECUTION";
export type PostKind = "COMPETITION" | "TRAINING_CAMP" | "OPERATING" | "OTHER";
export type PreparationPost = { id: string; code: string; label: string; kind: PostKind; sortOrder?: number };
export type Amounts = { revisedGross: number; revisedClubIncome: number; revisedFederation: number };
export type PreviousSource = Amounts & { label: string; fiscalYearLabel: string; actualGross: number | null; actualClubIncome: number | null; actualFederation: number | null };
export type PreparationLine = Amounts & {
  id: string; postId: string; label: string; fencingCategories: string[]; proposalStatus: ProposalStatus | null;
  amountsConfirmed: boolean; postKind: PostKind; status: "OPTION" | "BUDGETED" | "COMMITTED" | "DONE" | "CANCELLED" | "UNBUDGETED";
  includedInBudget: boolean; actualGross: number | null; actualClubIncome: number | null; actualFederation: number | null;
  plannedMonth: number | null; source?: PreviousSource | null; previousYearAmount?: number | null;
};
export const teams: Team[] = ["SENIORS", "M20", "M17", "COMMUN", "COMMISSION"];
export const postKinds: PostKind[] = ["COMPETITION", "TRAINING_CAMP", "OPERATING", "OTHER"];
export { countLabel };
export function teamOf(action: { fencingCategories: readonly string[] }, postKind: PostKind): Team {
  const categories = action.fencingCategories;
  if (categories.length) {
    if (categories.includes("SENIOR") && categories.every(value => ["SENIOR", "U23"].includes(value))) return "SENIORS";
    if (categories.every(value => ["M20", "U23"].includes(value))) return "M20";
    if (categories.every(value => ["M17", "M15", "M13"].includes(value))) return "M17";
  }
  return postKind === "OPERATING" ? "COMMISSION" : "COMMUN";
}
export function suggestFromPrevious(source: PreviousSource, upliftPercent = 5) {
  const actual = source.actualGross ?? source.actualFederation;
  const base = actual ?? source.revisedGross;
  const gross = Math.ceil(roundAmount(base * (1 + upliftPercent / 100)) / 100) * 100;
  const federation = source.revisedClubIncome > 0 || (source.actualClubIncome ?? 0) > 0 ? Math.round(gross / 200) * 100 : gross;
  return { gross, federation, clubIncome: gross - federation,
    basis: (actual === null ? "budget " : "réalisé ") + source.fiscalYearLabel + " + " + upliftPercent + " %" };
}
export function buildPreparationLines(previousPosts: Array<PreparationPost & { fiscalYearLabel: string }>, previousActions: Array<Amounts & {
  id: string; postId: string; label: string; status: string; plannedMonth: number | null; fencingCategories: FencingCategoryValue[]; sortOrder?: number;
}>) {
  const posts = previousPosts.map(post => ({ code: post.code, kind: post.kind, sortOrder: post.sortOrder ?? 0,
    label: post.label.split(post.fiscalYearLabel).join(String(Number(post.fiscalYearLabel) + 1)) }));
  const lines = previousActions.filter(action => action.status !== "CANCELLED").map(action => {
    const post = previousPosts.find(post => post.id === action.postId);
    if (!post) throw new Error("Poste de l’action précédente introuvable");
    return { postCode: post.code, sourceActionId: action.id, label: action.label, plannedMonth: action.plannedMonth,
      fencingCategories: [...action.fencingCategories], sortOrder: action.sortOrder ?? 0, proposalStatus: "PROPOSED" as const,
      revisedGross: action.revisedGross, revisedClubIncome: action.revisedClubIncome, revisedFederation: action.revisedFederation,
      previousYearAmount: action.revisedFederation, amountsConfirmed: false };
  });
  return { posts, lines };
}
function counts(lines: PreparationLine[]) {
  return { total: lines.length, retained: lines.filter(line => line.proposalStatus === "VALIDATED").length,
    pending: lines.filter(line => line.proposalStatus === "PROPOSED" || line.proposalStatus === null).length,
    arbitration: lines.filter(line => line.proposalStatus === "ARBITRATION").length,
    rejected: lines.filter(line => line.proposalStatus === "REJECTED").length,
    undated: lines.filter(line => line.proposalStatus !== "REJECTED" && line.postKind !== "OPERATING" && line.plannedMonth === null).length,
    unpriced: lines.filter(line => line.proposalStatus !== "REJECTED" && !line.amountsConfirmed).length };
}
export function computePreparationProgress(lines: PreparationLine[], { deadline, phase, today }: { deadline: Date | null; phase: Phase; today: Date }) {
  const totals = counts(lines);
  const byTeam = teams.map(team => { const selected = lines.filter(line => teamOf(line, line.postKind) === team);
    return { team, ...counts(selected), kinds: postKinds.map(kind => ({ kind, ...counts(selected.filter(line => line.postKind === kind)) })) }; });
  const sum = (selected: PreparationLine[], key: keyof Amounts) => roundAmount(selected.reduce((total, line) => total + line[key], 0));
  const retained = lines.filter(line => line.proposalStatus === "VALIDATED");
  const high = lines.filter(line => line.proposalStatus !== "REJECTED");
  const amounts = { retained: sum(retained, "revisedFederation"), high: sum(high, "revisedFederation"),
    gross: { retained: sum(retained, "revisedGross"), high: sum(high, "revisedGross") },
    clubIncome: { retained: sum(retained, "revisedClubIncome"), high: sum(high, "revisedClubIncome") } };
  const active = totals.total - totals.rejected;
  const ratio = (done: number, total: number) => total ? done / total : 1;
  const voted = phase === "EXECUTION";
  const percent = voted ? 100 : !totals.total ? 0 : Math.round(100 * (ratio(totals.total - totals.pending, totals.total) +
    ratio(active - totals.unpriced, active) + ratio(totals.total - totals.arbitration, totals.total)) / 3);
  const detail = (done: number, total: number) => done + " sur " + total;
  const steps = [
    { key: "opened", label: "Trame ouverte", done: true, detail: countLabel(totals.total, "ligne", "lignes") },
    { key: "confirmed", label: "Compétitions et stages confirmés", done: totals.pending === 0, detail: detail(totals.total - totals.pending, totals.total) },
    { key: "priced", label: "Montants chiffrés", done: totals.unpriced === 0, detail: detail(active - totals.unpriced, active) },
    { key: "arbitrated", label: "Arbitrages rendus", done: totals.arbitration === 0, detail: detail(totals.total - totals.arbitration, totals.total) },
    { key: "voted", label: "Budget voté", done: voted, detail: voted ? "Vote enregistré" : "Vote à venir" },
  ];
  const current = steps.findIndex(step => !step.done);
  const todo = byTeam.flatMap(item => {
    const parts = [item.pending ? countLabel(item.pending, "ligne à confirmer", "lignes à confirmer") : "", item.unpriced ? countLabel(item.unpriced, "montant à chiffrer", "montants à chiffrer") : "",
      item.arbitration ? countLabel(item.arbitration, "ligne à arbitrer", "lignes à arbitrer") : "",
      item.undated ? countLabel(item.undated, "mois à renseigner", "mois à renseigner") : ""].filter(Boolean);
    return parts.length ? [teamLabels[item.team] + " : " + parts.join(", ")] : [];
  });
  const days = deadline ? Math.ceil((Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate()) -
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86400000) : null;
  const due = deadline ? " Échéance le " + deadline.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) +
    (days! < 0 ? " (dépassée de " + countLabel(Math.abs(days!), "jour", "jours") + ")." : " (" + countLabel(days!, "jour restant", "jours restants") + ").") : "";
  const headline = (voted ? "Le budget est voté." : !totals.total ? "La trame est ouverte : ajoutez les compétitions et les stages." :
    "La préparation est avancée à " + percent + " % : " + countLabel(totals.pending, "ligne à confirmer", "lignes à confirmer") + ", " + countLabel(totals.unpriced, "montant à chiffrer", "montants à chiffrer") + " et " + countLabel(totals.arbitration, "arbitrage à rendre", "arbitrages à rendre") + ".") + due;
  return { ...totals, byTeam, amounts, steps: steps.map((step, index) => ({ ...step, current: !voted && index === current })), percent, todo, headline };
}
export function isInConstruction(line: PreparationLine, phase: Phase, includePending: boolean) {
  return phase === "EXECUTION" ? inBudget(line) : line.proposalStatus === "VALIDATED" || (includePending && line.proposalStatus !== "REJECTED");
}
export type PreviousTotals = Record<string, { budget: number; actual: number }>;
export function buildConstruction(posts: PreparationPost[], lines: PreparationLine[], previousTotalsByPostCode: PreviousTotals,
  { includePending, phase = "PREPARATION", fiscalYearLabel }: { includePending: boolean; phase?: Phase; fiscalYearLabel: string }) {
  const selected = lines.filter(line => isInConstruction(line, phase, includePending));
  const seasonParts = (items: PreparationLine[]) => {
    const part = (value: SeasonPart) => {
      const selected = items.filter(line => seasonPartOf(line.plannedMonth) === value);
      const sum = (key: keyof Amounts) => roundAmount(selected.reduce((total, line) => total + line[key], 0));
      return { gross: sum("revisedGross"), clubIncome: sum("revisedClubIncome"), federation: sum("revisedFederation"), count: selected.length };
    };
    return { END: part("END"), START: part("START"), NONE: part("NONE") };
  };
  const figures = (items: PreparationLine[], previous: { budget: number; actual: number }, actualItems = items) => {
    const sum = (key: keyof Amounts) => roundAmount(items.reduce((total, line) => total + line[key], 0));
    const gross = sum("revisedGross"), federation = sum("revisedFederation"), clubIncome = sum("revisedClubIncome");
    return { gross, clubIncome, federation, seasonParts: seasonParts(items), federationPercent: gross ? federation / gross * 100 : 0,
      previousBudget: previous.budget, previousActual: previous.actual, variance: roundAmount(federation - previous.budget),
      actual: { gross: roundAmount(actualItems.reduce((total, line) => total + (line.actualGross ?? 0), 0)),
        clubIncome: roundAmount(actualItems.reduce((total, line) => total + (line.actualClubIncome ?? 0), 0)),
        federation: roundAmount(actualItems.reduce((total, line) => total + (line.actualFederation ?? 0), 0)) } };
  };
  const result = posts.map(post => {
    const items = selected.filter(line => line.postId === post.id);
    return { ...post, ...figures(items, previousTotalsByPostCode[post.code] ?? { budget: 0, actual: 0 }, lines.filter(line => line.postId === post.id)),
      lines: items.map(line => ({ id: line.id, label: line.label, decision: line.proposalStatus,
        ...figures([line], { budget: line.source?.revisedFederation ?? line.previousYearAmount ?? 0, actual: line.source?.actualFederation ?? 0 }) })) };
  });
  const previous = Object.values(previousTotalsByPostCode).reduce((total, item) => ({ budget: roundAmount(total.budget + item.budget), actual: roundAmount(total.actual + item.actual) }), { budget: 0, actual: 0 });
  return { phase, fiscalYearLabel, seasonLabels: seasonLabelsOf(fiscalYearLabel), posts: result, totals: figures(selected, previous, lines) };
}
export function voteOutcome(proposalStatus: ProposalStatus | null, amounts: Amounts) {
  const retained = proposalStatus === "VALIDATED";
  return { status: retained ? "BUDGETED" as const : proposalStatus === "REJECTED" ? "CANCELLED" as const : "OPTION" as const,
    includedInBudget: retained, initialGross: retained ? amounts.revisedGross : 0,
    initialClubIncome: retained ? amounts.revisedClubIncome : 0, initialFederation: retained ? amounts.revisedFederation : 0 };
}
