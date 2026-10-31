import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ParsedMatrix } from "./budget-matrix";
import { buildMatrixDiff, matrixActionValues, type MatrixOverrides } from "./budget-matrix-diff";
import { computeFiscalYearSummary } from "./budget-pilotage";
import { existingMatrixAction, serializeBudgetAction } from "./budget-pilotage-data";

export function inferredSeasonLabel(fiscalYearLabel: string, month: number | null): string | null {
  if (month === null) return null;
  const year = Number(fiscalYearLabel);
  const start = month >= 9 ? year : year - 1;
  return String(start % 100).padStart(2, "0") + "/" + String((start + 1) % 100).padStart(2, "0");
}
export async function applyBudgetMatrix({ parsed, fiscalYearId, asOfDate, overrides, userId, fileName, fileUrl }: {
  parsed: ParsedMatrix; fiscalYearId: string; asOfDate: string; overrides?: MatrixOverrides;
  userId: string; fileName: string; fileUrl?: string | null;
}) {
  return prisma.$transaction(async tx => {
    let fiscalYear = await tx.fiscalYear.findUniqueOrThrow({ where: { id: fiscalYearId } });
    const existing = await tx.budgetAction.findMany({ where: { post: { fiscalYearId } }, include: { post: true } });
    const existingPosts = await tx.budgetPost.findMany({ where: { fiscalYearId } });
    const diff = buildMatrixDiff(parsed, existing.map(existingMatrixAction), overrides, existingPosts);
    if (parsed.restitutionAmount !== null && Number(fiscalYear.restitutionAmount) === 0) {
      fiscalYear = await tx.fiscalYear.update({ where: { id: fiscalYearId }, data: { restitutionAmount: parsed.restitutionAmount } });
    }
    const seasons = await tx.season.findMany({ select: { id: true, label: true } });
    const posts = new Map<string, string>();
    for (const post of parsed.posts) {
      const data = { label: post.label, kind: post.kind, sortOrder: post.sortOrder };
      const saved = await tx.budgetPost.upsert({
        where: { fiscalYearId_code: { fiscalYearId, code: post.code } },
        create: { fiscalYearId, code: post.code, ...data }, update: data,
      });
      posts.set(post.code, saved.id);
    }
    for (const [index, row] of parsed.actions.entries()) {
      const match = diff.actions[index];
      const previous = existing.find(action => action.id === match.actionId);
      const month = previous?.plannedMonth ?? row.plannedMonth;
      const seasonLabel = inferredSeasonLabel(fiscalYear.label, month);
      const seasonId = seasons.find(season => season.label === seasonLabel)?.id ?? null;
      const data = {
        ...matrixActionValues(row, previous?.status),
        ...(row.suggestedStatus === "UNBUDGETED" && previous?.estimatedFederation == null
          ? { estimatedFederation: row.estimatedFederation } : {}),
        matrixKey: row.matrixKey, origin: row.origin, sortOrder: index,
        fencingCategories: previous?.fencingCategories.length ? previous.fencingCategories : row.fencingCategories,
        plannedMonth: month, seasonId: previous?.seasonId ?? seasonId,
      };
      if (previous) {
        await tx.budgetAction.update({ where: { id: previous.id }, data });
      } else {
        await tx.budgetAction.create({ data: {
          ...data, postId: posts.get(row.postCode)!,
          initialGross: row.gross ?? 0, initialClubIncome: row.clubIncome ?? 0, initialFederation: row.federation ?? 0,
        } });
      }
    }
    const savedPosts = await tx.budgetPost.findMany({ where: { fiscalYearId }, orderBy: { sortOrder: "asc" } });
    const savedActions = await tx.budgetAction.findMany({
      where: { post: { fiscalYearId } }, include: { post: { select: { code: true } } }, orderBy: { sortOrder: "asc" },
    });
    const actions = savedActions.map(action => ({ ...serializeBudgetAction(action), postCode: action.post.code }));
    const summary = computeFiscalYearSummary({
      fiscalYear: { label: fiscalYear.label, restitutionAmount: Number(fiscalYear.restitutionAmount) }, posts: savedPosts, actions,
    });
    const snapshot = await tx.budgetSnapshot.create({ data: {
      fiscalYearId, asOfDate: new Date(asOfDate + "T00:00:00.000Z"), sourceFileName: fileName,
      fileUrl: fileUrl ?? null, importedById: userId,
      data: JSON.parse(JSON.stringify({ ...summary, actions })) as Prisma.InputJsonValue,
    } });
    return {
      snapshotId: snapshot.id, created: diff.actions.filter(action => action.kind === "new").length,
      updated: diff.actions.filter(action => action.kind === "updated").length,
      unchanged: diff.actions.filter(action => action.kind === "unchanged").length, missing: diff.missingActions.length,
    };
  }, { timeout: 30000 });
}
