import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildMonthlyReportText, computeActionFigures, computeFiscalYearSummary, isActionSettled, listVigilancePoints } from "./budget-pilotage";
import { serializeBudgetAction } from "./budget-pilotage-data";

const snapshotFigures = z.object({ budget: z.number(), actual: z.number(), landing: z.number() });
const snapshotSummary = z.object({
  posts: z.array(snapshotFigures.extend({ code: z.string(), label: z.string() })),
  totals: snapshotFigures,
});

export async function loadPilotage(label: string) {
  const year = await prisma.fiscalYear.findUnique({ where: { label } });
  if (!year) return null;
  const fiscalYear = { id: year.id, label: year.label, restitutionAmount: Number(year.restitutionAmount) };
  const [posts, rows, storedSnapshots, fiscalYears] = await Promise.all([
    prisma.budgetPost.findMany({ where: { fiscalYearId: year.id }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.budgetAction.findMany({ where: { post: { fiscalYearId: year.id } }, include: { post: { select: { code: true } } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.budgetSnapshot.findMany({ where: { fiscalYearId: year.id }, orderBy: [{ asOfDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, asOfDate: true, sourceFileName: true, createdAt: true, importedBy: { select: { name: true } }, data: true } }),
    prisma.fiscalYear.findMany({ select: { id: true, label: true }, orderBy: { label: "asc" } }),
  ]);
  const asOfDate = storedSnapshots[0]?.asOfDate ?? new Date();
  const context = { asOfDate, fiscalYearLabel: year.label };
  const actions = rows.map(row => {
    const action = { ...serializeBudgetAction(row), postCode: row.post.code };
    return { ...action, figures: computeActionFigures(action, context), isSettled: isActionSettled(action, context) };
  });
  const summary = computeFiscalYearSummary({ fiscalYear, posts, actions, asOfDate });
  const vigilance = listVigilancePoints(summary, actions, { asOfDate, fiscalYearLabel: year.label });
  const snapshots = storedSnapshots.map(({ data: _data, ...snapshot }) => snapshot);
  // Old imports remain immutable; expose only the figures needed by history.
  const snapshotSummaries = storedSnapshots.flatMap(snapshot => {
    const parsed = snapshotSummary.safeParse(snapshot.data);
    return parsed.success ? [{ id: snapshot.id, asOfDate: snapshot.asOfDate, ...parsed.data }] : [];
  });
  return { fiscalYear, fiscalYears, posts, actions, summary, asOfDate, vigilance, snapshots, snapshotSummaries,
    reportText: buildMonthlyReportText(summary, vigilance, asOfDate) };
}
