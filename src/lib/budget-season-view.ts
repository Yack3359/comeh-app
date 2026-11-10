import { roundAmount } from "./budget-matrix";
import { isInConstruction, teamOf, teams, type Phase, type PreparationLine, type PreparationPost } from "./budget-preparation";
import { seasonPartOf, seasonYears } from "./budget-season";

export type SeasonYearInput = { label: string; phase: Phase; posts: PreparationPost[]; lines: PreparationLine[] } | null;
export function buildSeasonView(seasonLabel: string, years: { start: SeasonYearInput; end: SeasonYearInput }, { includePending }: { includePending: boolean }) {
  const parsed = seasonYears(seasonLabel);
  if (!parsed) throw new Error("Saison invalide");
  const part = (year: SeasonYearInput, label: number, period: string) => ({ fiscalYearLabel: String(label),
    state: year?.phase ?? "MISSING" as const, period: period + label });
  const parts = { START: part(years.start, parsed.startYear, "sept.–déc. "), END: part(years.end, parsed.endYear, "janv.–août ") };
  const entries = ([{ year: years.start, part: "START" }, { year: years.end, part: "END" }] as const).flatMap(({ year, part }) =>
    year ? year.lines.filter(line => seasonPartOf(line.plannedMonth) === part).map(line => ({ line, part, fiscalYearLabel: year.label,
      selected: isInConstruction(line, year.phase, includePending), code: year.posts.find(post => post.id === line.postId)?.code })) : []);
  const figures = (items: typeof entries) => {
    const selected = items.filter(item => item.selected);
    const sum = (key: "revisedGross" | "revisedClubIncome" | "revisedFederation") => roundAmount(selected.reduce((total, item) => total + item.line[key], 0));
    return { gross: sum("revisedGross"), clubIncome: sum("revisedClubIncome"), federation: sum("revisedFederation"),
      actual: roundAmount(items.reduce((total, item) => total + (item.line.actualFederation ?? 0), 0)), count: selected.length };
  };
  const totals = (items: typeof entries) => ({ START: figures(items.filter(item => item.part === "START")),
    END: figures(items.filter(item => item.part === "END")), total: figures(items) });
  const merged = new Map<string, PreparationPost>();
  for (const year of [years.start, years.end]) for (const post of year?.posts ?? []) merged.set(post.code, post);
  const posts = [...merged.values()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.code.localeCompare(b.code)).map(post => {
    const items = entries.filter(item => item.code === post.code);
    return { code: post.code, label: post.label, kind: post.kind, ...totals(items),
      lines: items.filter(item => item.selected).sort((a, b) => (a.part === b.part ? 0 : a.part === "START" ? -1 : 1) ||
        a.line.plannedMonth! - b.line.plannedMonth! || a.line.label.localeCompare(b.line.label, "fr")).map(({ line, part, fiscalYearLabel }) => ({
        id: line.id, label: line.label, part, fiscalYearLabel, plannedMonth: line.plannedMonth, team: teamOf(line, line.postKind),
        decision: line.proposalStatus, status: line.status, gross: line.revisedGross, clubIncome: line.revisedClubIncome,
        federation: line.revisedFederation, actualFederation: line.actualFederation })) };
  });
  return { season: seasonLabel, parts, posts, teams: teams.map(team => ({ team, ...totals(entries.filter(item => teamOf(item.line, item.line.postKind) === team)) })),
    totals: totals(entries), undated: [years.start, years.end].flatMap(year => {
      if (!year) return [];
      const lines = year.lines.filter(line => line.plannedMonth === null && isInConstruction(line, year.phase, includePending));
      return [{ fiscalYearLabel: year.label, count: lines.length, federation: roundAmount(lines.reduce((total, line) => total + line.revisedFederation, 0)) }];
    }) };
}
