import type { prisma } from "@/lib/prisma";

export type ActionCandidate = { id: string; competitionId: string | null; fiscalYearLabel: string };
export function pickActionForExpense(candidates: ActionCandidate[], competitionId: string | null, date: string): string | null {
  if (competitionId === null) return null;
  const matches = candidates.filter(candidate => candidate.competitionId === competitionId);
  if (matches.length === 1) return matches[0].id;
  const inYear = matches.filter(candidate => candidate.fiscalYearLabel === date.slice(0, 4));
  return inYear.length === 1 ? inYear[0].id : null;
}
export async function resolveExpenseAction(client: { budgetAction: Pick<typeof prisma.budgetAction, "findUnique" | "findMany"> },
  input: { requested: string | null | undefined; competitionId: string | null; date: string }):
  Promise<{ ok: true; budgetActionId: string | null } | { ok: false }> {
  if (typeof input.requested === "string") {
    const action = await client.budgetAction.findUnique({ where: { id: input.requested }, select: { id: true, post: { select: { fiscalYear: { select: { phase: true } } } } } });
    return action?.post.fiscalYear.phase === "EXECUTION" ? { ok: true, budgetActionId: action.id } : { ok: false };
  }
  if (input.requested === null || input.competitionId === null) return { ok: true, budgetActionId: null };
  const actions = await client.budgetAction.findMany({ where: { competitionId: input.competitionId, post: { fiscalYear: { phase: "EXECUTION" } } },
    select: { id: true, competitionId: true, post: { select: { fiscalYear: { select: { label: true } } } } } });
  return { ok: true, budgetActionId: pickActionForExpense(actions.map(action => ({ id: action.id, competitionId: action.competitionId, fiscalYearLabel: action.post.fiscalYear.label })), input.competitionId, input.date) };
}
