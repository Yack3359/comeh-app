import { roundAmount } from "./budget-amount";
import { money, type VigilancePoint } from "./budget-pilotage";

export type EnteredTotal = { amount: number; count: number };
export type ActionReconciliation = EnteredTotal & { notBooked: number };
export function reconcileAction(action: { actualGross: number | null }, entered?: EnteredTotal): ActionReconciliation {
  if (!entered || entered.count === 0) return { amount: 0, count: 0, notBooked: 0 };
  return { ...entered, notBooked: roundAmount(Math.max(entered.amount - (action.actualGross ?? 0), 0)) };
}
export function buildReconciliation(actions: Array<{ entered: ActionReconciliation }>, unattached: EnteredTotal):
  { entered: number; count: number; notBooked: number; unattached: EnteredTotal } {
  return { entered: roundAmount(actions.reduce((sum, action) => sum + action.entered.amount, 0)),
    count: actions.reduce((sum, action) => sum + action.entered.count, 0),
    notBooked: roundAmount(actions.reduce((sum, action) => sum + action.entered.notBooked, 0)),
    unattached: { amount: roundAmount(unattached.amount), count: unattached.count } };
}
export function listReconciliationPoints(actions: Array<{ id: string; label: string; postCode: string; status: string; isSettled: boolean; entered: ActionReconciliation }>): VigilancePoint[] {
  return actions.filter(action => action.entered.notBooked > 0.5).map(action => {
    const level: VigilancePoint["level"] = action.isSettled || action.status === "CANCELLED" ? "orange" : "info";
    return { level, postCode: action.postCode, actionId: action.id,
      message: action.label + " : " + money(action.entered.notBooked) + " de notes de frais saisies ne figurent pas encore dans le réalisé fédé" +
        (level === "orange" ? " — l’atterrissage est probablement sous-estimé" : "") };
  });
}
