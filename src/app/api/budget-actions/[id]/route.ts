import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { normalizeMatrixLabel } from "@/lib/budget-matrix";
import { serializeBudgetAction } from "@/lib/budget-pilotage-data";
import { budgetActionUpdateSchema, pilotageParamsSchema, requiresRevisionReason, validateAdjustment, includedInBudgetForStatus } from "@/lib/budget-pilotage-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
export async function PATCH(request: Request, context: Context) {
  const params = pilotageParamsSchema.safeParse(context.params);
  const body = budgetActionUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!params.success) return invalidDataResponse(params.error);
  if (!body.success) return invalidDataResponse(body.error);
  try {
    return await runAsAuthenticatedUser(async () => {
      const action = await prisma.$transaction(async tx => {
        const current = await tx.budgetAction.findUniqueOrThrow({ where: { id: params.data.id } });
        if (requiresRevisionReason(serializeBudgetAction(current), body.data)) {
          throw new z.ZodError([{ code: "custom", path: ["revisionReason"], message: "Un motif est obligatoire lorsqu’un montant révisé change" }]);
        }
        validateAdjustment(serializeBudgetAction(current), body.data);
        return tx.budgetAction.update({ where: { id: current.id }, data: {
          ...body.data, ...(body.data.status !== undefined ? { includedInBudget: includedInBudgetForStatus(body.data.status, current.includedInBudget) } : {}),
          ...(body.data.label !== undefined && current.matrixKey !== null ? { matrixKey: normalizeMatrixLabel(body.data.label) } : {}),
        } });
      });
      return NextResponse.json(serializeBudgetAction(action));
    }, writeRoles);
  } catch (error) {
    if (error instanceof z.ZodError) return invalidDataResponse(error);
    return apiErrorResponse(error, "Impossible de modifier l’action budgétaire");
  }
}
export async function DELETE(_request: Request, context: Context) {
  const params = pilotageParamsSchema.safeParse(context.params);
  if (!params.success) return invalidDataResponse(params.error);
  try {
    return await runAsAuthenticatedUser(async () => {
      await prisma.budgetAction.delete({ where: { id: params.data.id } });
      return NextResponse.json({ success: true });
    }, writeRoles);
  } catch (error) { return apiErrorResponse(error, "Impossible de supprimer l’action budgétaire"); }
}
