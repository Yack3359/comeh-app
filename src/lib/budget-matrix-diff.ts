import type { BudgetActionStatus } from "@prisma/client";
import { normalizeMatrixLabel, type MatrixAction, type MatrixPost, type ParsedMatrix } from "./budget-matrix";

export type ExistingAction = {
  id: string; postCode: string; label: string; matrixKey: string | null;
  matrixLineNumber: number | null; matrixOccurrence: number | null; sortOrder: number; estimatedFederation: number | null;
  status: BudgetActionStatus; includedInBudget: boolean; proposedSaving: boolean;
  revisedGross: number; revisedClubIncome: number; revisedFederation: number;
  actualGross: number | null; actualClubIncome: number | null; actualFederation: number | null;
  previousYearAmount: number | null; notes: string | null;
};
export type MatrixOverrides = Record<number, string | null>;
export type ExistingPost = Pick<MatrixPost, "code" | "label">;
export type MatrixMatch = { rowNumber: number; actionId: string | null; score: number; matchedBy: "label" | "position"; ambiguous: boolean };
type Change = { field: string; before: string | number | boolean | null; after: string | number | boolean | null };
export type MatrixDiff = {
  posts: Array<{ code: string; label: string; kind: "new" | "updated"; previousLabel?: string }>;
  actions: Array<MatrixMatch & { kind: "new" | "updated" | "unchanged"; label: string; previousLabel?: string; statusPreserved: boolean; changes: Change[] }>;
  missingActions: ExistingAction[]; ignoredRows: ParsedMatrix["ignoredRows"]; warnings: string[];
};
export class MatrixMatchError extends Error {}

export function importedActionStatus(current: BudgetActionStatus, suggested: MatrixAction["suggestedStatus"]): BudgetActionStatus {
  if ((current === "CANCELLED" || current === "DONE") && suggested !== "DONE") return current;
  return current === "COMMITTED" && suggested === "BUDGETED" ? current : suggested;
}
export function labelSimilarity(a: string, b: string): number {
  const left = new Set(normalizeMatrixLabel(a).split(" ").filter(Boolean));
  const right = new Set(normalizeMatrixLabel(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  return 2 * [...left].filter(token => right.has(token)).length / (left.size + right.size);
}
export function matchMatrixActions(parsed: MatrixAction[], existing: ExistingAction[], overrides: MatrixOverrides = {}): MatrixMatch[] {
  const matches = new Map<number, MatrixMatch>();
  const used = new Set<string>();
  // Reserve manual assignments before the greedy pass, including explicit creations.
  for (const [key, actionId] of Object.entries(overrides)) {
    const rowNumber = Number(key);
    const row = parsed.find(action => action.rowNumber === rowNumber);
    const target = existing.find(action => action.id === actionId);
    if (!row || (actionId !== null && (!target || target.postCode !== row.postCode || used.has(actionId)))) {
      throw new MatrixMatchError("Rapprochement invalide pour la ligne " + key);
    }
    matches.set(rowNumber, { rowNumber, actionId, score: actionId === null ? 0 : 1, matchedBy: "label", ambiguous: false });
    if (actionId !== null) used.add(actionId);
  }
  const samePosition = (row: MatrixAction, action: ExistingAction) => row.lineNumber !== null && row.lineOccurrence !== null &&
    row.lineNumber === action.matrixLineNumber && row.lineOccurrence === action.matrixOccurrence;
  const candidates = parsed.flatMap((row, sortOrder) => matches.has(row.rowNumber) ? [] :
    existing.filter(action => action.postCode === row.postCode && !used.has(action.id)).map(action => ({
      rowNumber: row.rowNumber, actionId: action.id, matchedBy: "label" as const, ambiguous: false,
      score: row.matrixKey === action.matrixKey ? 1 : labelSimilarity(row.label, action.label),
      position: samePosition(row, action) ? 1 : 0, distance: Math.abs(action.sortOrder - sortOrder),
    })),
  ).filter(match => match.score >= 0.5).sort((a, b) => b.score - a.score || b.position - a.position ||
    a.distance - b.distance || a.rowNumber - b.rowNumber);
  for (const candidate of candidates) {
    if (matches.has(candidate.rowNumber) || used.has(candidate.actionId)) continue;
    const ambiguous = candidates.some(other => other.rowNumber === candidate.rowNumber && other.actionId !== candidate.actionId &&
      !used.has(other.actionId) && other.score === candidate.score && other.position === candidate.position && other.distance === candidate.distance);
    matches.set(candidate.rowNumber, { rowNumber: candidate.rowNumber, actionId: ambiguous ? null : candidate.actionId,
      score: candidate.score, matchedBy: "label", ambiguous });
    if (!ambiguous) used.add(candidate.actionId);
  }
  // Position is only a fallback after every label assignment has been reserved.
  for (const [sortOrder, row] of parsed.entries()) {
    if (matches.has(row.rowNumber)) continue;
    const targets = existing.filter(action => !used.has(action.id) && action.postCode === row.postCode && samePosition(row, action))
      .sort((a, b) => Math.abs(a.sortOrder - sortOrder) - Math.abs(b.sortOrder - sortOrder));
    const target = targets[0];
    if (target) {
      const ambiguous = targets.length > 1 && Math.abs(target.sortOrder - sortOrder) === Math.abs(targets[1].sortOrder - sortOrder);
      matches.set(row.rowNumber, { rowNumber: row.rowNumber, actionId: ambiguous ? null : target.id,
        score: labelSimilarity(row.label, target.label), matchedBy: "position", ambiguous });
      if (!ambiguous) used.add(target.id);
    }
  }
  return parsed.map(row => matches.get(row.rowNumber) ?? { rowNumber: row.rowNumber, actionId: null, score: 0, matchedBy: "label", ambiguous: false });
}
export function matrixActionValues(row: MatrixAction, currentStatus?: BudgetActionStatus) {
  return {
    label: row.label, status: currentStatus ? importedActionStatus(currentStatus, row.suggestedStatus) : row.suggestedStatus,
    matrixLineNumber: row.lineNumber, matrixOccurrence: row.lineOccurrence,
    includedInBudget: row.includedInBudget, proposedSaving: row.proposedSaving,
    revisedGross: row.gross ?? 0, revisedClubIncome: row.clubIncome ?? 0, revisedFederation: row.federation ?? 0,
    actualGross: row.actualGross, actualClubIncome: row.actualClubIncome, actualFederation: row.actualFederation,
    previousYearAmount: row.previousYear, notes: row.notes,
  };
}
// Post labels cannot be recovered from ExistingAction; callers with database state
// supply the optional fourth argument to include empty posts and label changes.
export function buildMatrixDiff(parsed: ParsedMatrix, existing: ExistingAction[], overrides?: MatrixOverrides, existingPosts?: ExistingPost[]): MatrixDiff {
  const matches = matchMatrixActions(parsed.actions, existing, overrides);
  const knownPosts = existingPosts ?? [...new Set(existing.map(action => action.postCode))].map(code => ({ code, label: undefined }));
  const posts: MatrixDiff["posts"] = parsed.posts.flatMap<MatrixDiff["posts"][number]>(post => {
    const old = knownPosts.find(item => item.code === post.code);
    if (!old) return [{ code: post.code, label: post.label, kind: "new" as const }];
    if (old.label !== undefined && old.label !== post.label) return [{ code: post.code, label: post.label, previousLabel: old.label, kind: "updated" as const }];
    return [];
  });
  const actions: MatrixDiff["actions"] = parsed.actions.map((row, index) => {
    const match = matches[index];
    const previous = existing.find(action => action.id === match.actionId);
    const next = { ...matrixActionValues(row, previous?.status),
      estimatedFederation: previous?.estimatedFederation ?? (row.suggestedStatus === "UNBUDGETED" ? row.estimatedFederation : null),
    };
    const changes: Change[] = [];
    for (const field of Object.keys(next) as Array<keyof typeof next>) {
      const before = previous?.[field] ?? null;
      if (before !== next[field]) changes.push({ field, before, after: next[field] });
    }
    return { ...match, label: row.label, previousLabel: previous?.label,
      statusPreserved: !!previous && next.status !== row.suggestedStatus,
      kind: !previous ? "new" : changes.length ? "updated" : "unchanged", changes };
  });
  const matchedIds = new Set(matches.map(match => match.actionId));
  return { posts, actions, missingActions: existing.filter(action => !matchedIds.has(action.id)),
    ignoredRows: parsed.ignoredRows, warnings: parsed.warnings };
}
