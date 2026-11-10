export type SeasonPart = "END" | "START" | "NONE";

export function inferredSeasonLabel(fiscalYearLabel: string, month: number | null): string | null {
  if (month === null) return null;
  const year = Number(fiscalYearLabel);
  const start = month >= 9 ? year : year - 1;
  return String(start % 100).padStart(2, "0") + "/" + String((start + 1) % 100).padStart(2, "0");
}
export function seasonPartOf(month: number | null): SeasonPart {
  return month === null ? "NONE" : month >= 9 ? "START" : "END";
}
export function seasonLabelsOf(fiscalYearLabel: string) {
  return { END: inferredSeasonLabel(fiscalYearLabel, 1)!, START: inferredSeasonLabel(fiscalYearLabel, 9)! };
}
export function seasonYears(seasonLabel: string): { startYear: number; endYear: number } | null {
  if (!/^[0-9]{2}[/][0-9]{2}$/.test(seasonLabel)) return null;
  const [start, end] = seasonLabel.split("/").map(Number);
  return (start + 1) % 100 === end ? { startYear: 2000 + start, endYear: 2001 + start } : null;
}
export function seasonPartTitle(part: SeasonPart, fiscalYearLabel: string): string {
  if (part === "NONE") return "Sans mois (année entière ou à préciser)";
  const labels = seasonLabelsOf(fiscalYearLabel);
  return part === "END" ? "Fin de saison " + labels.END + " (janv.–août " + fiscalYearLabel + ")" :
    "Début de saison " + labels.START + " (sept.–déc. " + fiscalYearLabel + ")";
}
