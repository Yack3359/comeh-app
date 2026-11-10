import type { Prisma } from "@prisma/client";
import { runWithoutAudit } from "@/lib/audit-context";
import { prisma } from "@/lib/prisma";
import type { ParsedMatrix } from "./budget-matrix";
import { buildMatrixDiff, matrixActionValues, MatrixMatchError, type MatrixOverrides } from "./budget-matrix-diff";
import { computeFiscalYearSummary } from "./budget-pilotage";
import { existingMatrixAction, serializeBudgetAction } from "./budget-pilotage-data";

import { inferredSeasonLabel } from "./budget-season";
export { inferredSeasonLabel } from "./budget-season";

export class MatrixChronologyError extends Error {}
type ApplyMatrixInput = {
  parsed: ParsedMatrix; fiscalYearId: string; asOfDate: string; overrides?: MatrixOverrides;
  userId: string; fileName: string; fileUrl?: string | null; historicalOnly?: boolean;
};
export async function applyBudgetMatrix(input: ApplyMatrixInput) {
  return runWithoutAudit(() => applyInTransaction(input));
}
function applyInTransaction({ parsed, fiscalYearId, asOfDate, overrides, userId, fileName, fileUrl, historicalOnly = false }: ApplyMatrixInput) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM fiscal_years WHERE id = ${fiscalYearId} FOR UPDATE`;
    let fiscalYear = await tx.fiscalYear.findUniqueOrThrow({ where: { id: fiscalYearId } });
    if (fiscalYear.phase === "PREPARATION") throw new MatrixChronologyError("Votez d’abord le budget de l’exercice");
    const situationDate = new Date(asOfDate + "T00:00:00.000Z");
    const latest = await tx.budgetSnapshot.findFirst({ where: { fiscalYearId }, orderBy: { asOfDate: "desc" }, select: { asOfDate: true } });
    if (!historicalOnly && latest && situationDate < latest.asOfDate) {
      throw new MatrixChronologyError("Cette matrice est antérieure au dernier snapshot de l’exercice. Cochez « Importer comme historique seulement » pour la conserver sans modifier les actions.");
    }
    async function saveSnapshot(data: object, counts: { created: number; updated: number; unchanged: number; missing: number }) {
      const snapshot = await tx.budgetSnapshot.create({ data: {
        fiscalYearId, asOfDate: situationDate, sourceFileName: fileName, fileUrl: fileUrl ?? null, importedById: userId,
        data: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
      } });
      await tx.auditLog.create({ data: {
        userId, action: "IMPORT_MATRIX", entityType: "BudgetSnapshot", entityId: snapshot.id,
        diffJson: { fileName, asOfDate, historicalOnly, ...counts },
      } });
      return { snapshotId: snapshot.id, ...counts, ...(historicalOnly ? { historicalOnly: true } : {}) };
    }
    if (historicalOnly) {
      // Reconstruct the uploaded situation independently of today's actions and manual decisions.
      const posts = parsed.posts.map(post => ({ ...post, id: "matrix-post-" + post.code }));
      const actions = parsed.actions.map((row, index) => ({
        ...matrixActionValues(row), id: "matrix-row-" + row.rowNumber, postId: "matrix-post-" + row.postCode, postCode: row.postCode,
        matrixKey: row.matrixKey, origin: row.origin, sortOrder: index, settled: null,
        plannedMonth: row.plannedMonth, fencingCategories: row.fencingCategories, estimatedFederation: row.estimatedFederation,
        initialGross: row.gross ?? 0, initialClubIncome: row.clubIncome ?? 0, initialFederation: row.federation ?? 0,
        adjustmentFederation: 0, adjustmentReason: null, revisionReason: null, comment: null, seasonId: null, competitionId: null,
      }));
      const summary = computeFiscalYearSummary({
        fiscalYear: { label: fiscalYear.label, restitutionAmount: parsed.restitutionAmount ?? 0 }, posts, actions, asOfDate: situationDate,
      });
      return saveSnapshot({ ...summary, actions }, { created: 0, updated: 0, unchanged: 0, missing: 0 });
    }
    const existing = await tx.budgetAction.findMany({ where: { post: { fiscalYearId } }, include: { post: true } });
    const existingPosts = await tx.budgetPost.findMany({ where: { fiscalYearId } });
    const diff = buildMatrixDiff(parsed, existing.map(existingMatrixAction), overrides, existingPosts);
    if (diff.actions.some(action => action.ambiguous)) throw new MatrixMatchError("Rapprochement ambigu : un rapprochement manuel est requis avant validation");
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
      fiscalYear: { label: fiscalYear.label, restitutionAmount: Number(fiscalYear.restitutionAmount) }, posts: savedPosts, actions, asOfDate: situationDate,
    });
    return saveSnapshot({ ...summary, actions }, {
      created: diff.actions.filter(action => action.kind === "new").length,
      updated: diff.actions.filter(action => action.kind === "updated").length,
      unchanged: diff.actions.filter(action => action.kind === "unchanged").length, missing: diff.missingActions.length,
    });
  }, { maxWait: 20000, timeout: 100000 });
}
