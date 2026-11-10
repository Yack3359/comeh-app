import { prisma } from "@/lib/prisma";
import { serializeBudgetAction } from "./budget-pilotage-data";
import { seasonYears } from "./budget-season";
import { buildSeasonView, type SeasonYearInput } from "./budget-season-view";

export async function loadSeasonView(seasonLabel: string) {
  const parsed = seasonYears(seasonLabel);
  if (!parsed) throw new Error("Saison invalide");
  async function loadYear(label: number): Promise<SeasonYearInput> {
    const year = await prisma.fiscalYear.findUnique({ where: { label: String(label) } });
    if (!year) return null;
    const [posts, rows] = await Promise.all([
      prisma.budgetPost.findMany({ where: { fiscalYearId: year.id }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
      prisma.budgetAction.findMany({ where: { post: { fiscalYearId: year.id } }, include: { post: { select: { kind: true } } } }),
    ]);
    return { label: year.label, phase: year.phase, posts, lines: rows.map(({ post, ...row }) => ({ ...serializeBudgetAction(row), postKind: post.kind })) };
  }
  const [start, end] = await Promise.all([loadYear(parsed.startYear), loadYear(parsed.endYear)]);
  return { retained: buildSeasonView(seasonLabel, { start, end }, { includePending: false }),
    high: buildSeasonView(seasonLabel, { start, end }, { includePending: true }) };
}
