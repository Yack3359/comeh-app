import type { BudgetAction, BudgetPost } from "@prisma/client";
import type { ExistingAction } from "./budget-matrix-diff";

// Convert Decimal explicitly before JSON serialization (Decimal.toJSON returns a string).
export function serializeBudgetAction(action: BudgetAction) {
  return {
    ...action,
    comment: action.comment,
    initialGross: Number(action.initialGross), initialClubIncome: Number(action.initialClubIncome), initialFederation: Number(action.initialFederation),
    revisedGross: Number(action.revisedGross), revisedClubIncome: Number(action.revisedClubIncome), revisedFederation: Number(action.revisedFederation),
    clubIncomeWaived: Number(action.clubIncomeWaived),
    adjustmentFederation: Number(action.adjustmentFederation),
    previousYearAmount: action.previousYearAmount === null ? null : Number(action.previousYearAmount),
    estimatedFederation: action.estimatedFederation === null ? null : Number(action.estimatedFederation),
    actualGross: action.actualGross === null ? null : Number(action.actualGross),
    actualClubIncome: action.actualClubIncome === null ? null : Number(action.actualClubIncome),
    actualFederation: action.actualFederation === null ? null : Number(action.actualFederation),
  };
}
export function existingMatrixAction(action: BudgetAction & { post: Pick<BudgetPost, "code"> }): ExistingAction {
  return { ...serializeBudgetAction(action), postCode: action.post.code };
}
