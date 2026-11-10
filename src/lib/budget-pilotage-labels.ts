import type { BudgetActionStatus } from "@prisma/client";
import type { Flag } from "./budget-pilotage";

export const statusLabels: Record<BudgetActionStatus, string> = {
  OPTION: "Option", BUDGETED: "Budgétée", COMMITTED: "Engagée", DONE: "Réalisée", CANCELLED: "Annulée", UNBUDGETED: "Hors budget",
};
export const flagLabels: Record<Flag, string> = {
  green: "Dans le budget", orange: "Atterrissage au-dessus du budget", red: "Budget dépassé",
};
export const categoryLabels = { SENIOR: "Sénior", U23: "U23", M20: "M20", M17: "M17", M15: "M15", M13: "M13" };
export function monthLabel(month: number | null) {
  return month === null ? "—" : new Date(Date.UTC(2026, month - 1, 1)).toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" });
}

export const teamLabels = { SENIORS: "Séniors", M20: "M20 / U23", M17: "M17", COMMUN: "Commun", COMMISSION: "Commission" };
export const proposalLabels = { PROPOSED: "Proposée (à confirmer)", VALIDATED: "Retenue", ARBITRATION: "À arbitrer", REJECTED: "Écartée" };

export function countLabel(count: number, singular: string, plural: string) {
  return count + " " + (count > 1 ? plural : singular);
}
