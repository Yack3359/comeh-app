import type { Prisma } from "@prisma/client";
import { inferredSeasonLabel } from "./budget-matrix-apply";
import { prisma } from "@/lib/prisma";
import { computeFiscalYearSummary } from "./budget-pilotage";
import { serializeBudgetAction } from "./budget-pilotage-data";
import { buildConstruction, computePreparationProgress, suggestFromPrevious, teamOf, type PreviousTotals } from "./budget-preparation";

export async function preparationSeasonId(tx: Prisma.TransactionClient, fiscalYearLabel: string, plannedMonth: number | null) {
  const label = inferredSeasonLabel(fiscalYearLabel, plannedMonth);
  if (label === null) return null;
  const season = await tx.season.findUnique({ where: { label }, select: { id: true } });
  return season?.id ?? null;
}
export async function preparationYearLabel(label?: string) {
  if (label) return label;
  const year = await prisma.fiscalYear.findFirst({ where: { phase: "PREPARATION" }, orderBy: { label: "asc" }, select: { label: true } });
  return year?.label ?? String(new Date().getFullYear() + 1);
}
export async function loadPreviousBudget(label: string) {
  const year = await prisma.fiscalYear.findUnique({ where: { label: String(Number(label) - 1) } });
  if (!year) return { year: null, totalsByPostCode: {} as PreviousTotals };
  const [posts, rows, snapshot] = await Promise.all([
    prisma.budgetPost.findMany({ where: { fiscalYearId: year.id }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.budgetAction.findMany({ where: { post: { fiscalYearId: year.id } } }),
    prisma.budgetSnapshot.findFirst({ where: { fiscalYearId: year.id }, orderBy: [{ asOfDate: "desc" }, { createdAt: "desc" }], select: { asOfDate: true } }),
  ]);
  const summary = computeFiscalYearSummary({ fiscalYear: { label: year.label, restitutionAmount: Number(year.restitutionAmount) },
    posts, actions: rows.map(serializeBudgetAction), asOfDate: snapshot?.asOfDate ?? new Date() });
  return { year: { label: year.label, budget: summary.totals.budget, actual: summary.totals.actual, landing: summary.totals.landing },
    totalsByPostCode: Object.fromEntries(summary.posts.map(post => [post.code, { budget: post.budget, actual: post.actual }])) };
}
export async function loadPreparation(label: string) {
  const year = await prisma.fiscalYear.findUnique({ where: { label } });
  if (!year) return null;
  const [posts, rows, fiscalYears, previous] = await Promise.all([
    prisma.budgetPost.findMany({ where: { fiscalYearId: year.id }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.budgetAction.findMany({ where: { post: { fiscalYearId: year.id } }, include: { post: { select: { kind: true, code: true } },
      proposedBy: { select: { name: true } }, sourceAction: { include: { post: { select: { fiscalYear: { select: { label: true } } } } } } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.fiscalYear.findMany({ select: { id: true, label: true, phase: true }, orderBy: { label: "asc" } }), loadPreviousBudget(label),
  ]);
  const fiscalYear = { id: year.id, label, phase: year.phase, preparationDeadline: year.preparationDeadline,
    targetFederation: year.targetFederation === null ? null : Number(year.targetFederation) };
  const lines = rows.map(({ sourceAction, proposedBy, post, ...row }) => {
    const source = sourceAction ? { label: sourceAction.label, fiscalYearLabel: sourceAction.post.fiscalYear.label,
      revisedGross: Number(sourceAction.revisedGross), revisedClubIncome: Number(sourceAction.revisedClubIncome), revisedFederation: Number(sourceAction.revisedFederation),
      actualGross: sourceAction.actualGross === null ? null : Number(sourceAction.actualGross), actualClubIncome: sourceAction.actualClubIncome === null ? null : Number(sourceAction.actualClubIncome),
      actualFederation: sourceAction.actualFederation === null ? null : Number(sourceAction.actualFederation) } : null;
    return { ...serializeBudgetAction(row), postCode: post.code, postKind: post.kind, team: teamOf(row, post.kind),
      proposedByName: proposedBy?.name ?? null, source, suggestion: source ? suggestFromPrevious(source) : null };
  });
  return { fiscalYear, previousYear: previous.year, fiscalYears, posts, lines,
    canOpen: posts.length === 0 && Object.keys(previous.totalsByPostCode).length > 0,
    progress: computePreparationProgress(lines, { deadline: year.preparationDeadline, phase: year.phase, today: new Date() }),
    construction: { retained: buildConstruction(posts, lines, previous.totalsByPostCode, { includePending: false, phase: year.phase }),
      high: buildConstruction(posts, lines, previous.totalsByPostCode, { includePending: true, phase: year.phase }) } };
}
