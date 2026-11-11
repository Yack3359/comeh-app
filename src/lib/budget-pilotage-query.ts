import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildMonthlyReportText, buildPilotageHeadline, computeActionFigures, computeFiscalYearSummary, isActionSettled, listVigilancePoints } from "./budget-pilotage";
import { serializeBudgetAction } from "./budget-pilotage-data";
import { buildReconciliation, listReconciliationPoints, reconcileAction } from "./budget-reconciliation";

import { buildConstruction } from "./budget-preparation";
import { loadPreviousBudget } from "./budget-preparation-query";

const snapshotFigures = z.object({ budget: z.number(), actual: z.number(), landing: z.number() });
const snapshotSummary = z.object({
  posts: z.array(snapshotFigures.extend({ code: z.string(), label: z.string() })),
  totals: snapshotFigures,
});

export async function loadPilotage(label: string) {
  const year = await prisma.fiscalYear.findUnique({ where: { label } });
  if (!year) return null;
  const fiscalYear = { id: year.id, label: year.label, phase: year.phase, restitutionAmount: Number(year.restitutionAmount) };
  const [posts, rows, storedSnapshots, fiscalYears, previous, enteredRows, unattachedTotal] = await Promise.all([
    prisma.budgetPost.findMany({ where: { fiscalYearId: year.id }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.budgetAction.findMany({ where: { post: { fiscalYearId: year.id } }, include: { post: { select: { code: true } }, sourceAction: { include: { post: { select: { fiscalYear: { select: { label: true } } } } } } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.budgetSnapshot.findMany({ where: { fiscalYearId: year.id }, orderBy: [{ asOfDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, asOfDate: true, sourceFileName: true, createdAt: true, importedBy: { select: { name: true } }, data: true } }),
    prisma.fiscalYear.findMany({ select: { id: true, label: true }, orderBy: { label: "asc" } }),
    loadPreviousBudget(label),
    prisma.expense.groupBy({ by: ["budgetActionId"], where: { budgetAction: { post: { fiscalYearId: year.id } } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.expense.aggregate({ where: { budgetActionId: null, date: { gte: new Date(Date.UTC(Number(year.label), 0, 1)), lt: new Date(Date.UTC(Number(year.label) + 1, 0, 1)) } }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const asOfDate = storedSnapshots[0]?.asOfDate ?? new Date();
  const context = { asOfDate, fiscalYearLabel: year.label };
  const enteredByAction = new Map(enteredRows.map(row => [row.budgetActionId, { amount: Number(row._sum.amount ?? 0), count: row._count._all }]));
  const unattached = { amount: Number(unattachedTotal._sum.amount ?? 0), count: unattachedTotal._count._all };
  const actions = rows.map(({ sourceAction, ...row }) => {
    const source = sourceAction ? { ...serializeBudgetAction(sourceAction), fiscalYearLabel: sourceAction.post.fiscalYear.label } : null;
    const action = { ...serializeBudgetAction(row), postCode: row.post.code, source };
    return { ...action, figures: computeActionFigures(action, context), isSettled: isActionSettled(action, context), entered: reconcileAction(action, enteredByAction.get(action.id)) };
  });
  const summary = computeFiscalYearSummary({ fiscalYear, posts, actions, asOfDate });
  const reconciliation = buildReconciliation(actions, unattached);
  const vigilance = [...listVigilancePoints(summary, actions, { asOfDate, fiscalYearLabel: year.label }), ...listReconciliationPoints(actions)];
  const snapshots = storedSnapshots.map(({ data: _data, ...snapshot }) => snapshot);
  // Old imports remain immutable; expose only the figures needed by history.
  const snapshotSummaries = storedSnapshots.flatMap(snapshot => {
    const parsed = snapshotSummary.safeParse(snapshot.data);
    return parsed.success ? [{ id: snapshot.id, asOfDate: snapshot.asOfDate, ...parsed.data }] : [];
  });
  return { fiscalYear, fiscalYears, posts, actions, summary, reconciliation, asOfDate, vigilance, snapshots, snapshotSummaries,
    headline: buildPilotageHeadline(summary, asOfDate),
    construction: buildConstruction(posts, actions.map(action => ({ ...action, postKind: posts.find(post => post.id === action.postId)!.kind })), previous.totalsByPostCode, { includePending: false, phase: year.phase, fiscalYearLabel: year.label }),
    reportText: buildMonthlyReportText(summary, vigilance, asOfDate) };
}
