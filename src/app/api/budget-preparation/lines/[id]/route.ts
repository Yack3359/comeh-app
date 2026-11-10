import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { roundAmount } from "@/lib/budget-matrix";
import { serializeBudgetAction } from "@/lib/budget-pilotage-data";
import { pilotageParamsSchema } from "@/lib/budget-pilotage-validations";
import { preparationSeasonId } from "@/lib/budget-preparation-query";
import { preparationUpdateSchema, validatePreparationAmounts } from "@/lib/budget-preparation-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER, Role.CONTRIBUTOR] as const;
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
export async function PATCH(request: Request, context: Context) {
  const params = pilotageParamsSchema.safeParse(context.params);
  const body = preparationUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!params.success) return invalidDataResponse(params.error);
  if (!body.success) return invalidDataResponse(body.error);
  try {
    return await runAsAuthenticatedUser(async () => prisma.$transaction(async tx => {
      const current = await tx.budgetAction.findUniqueOrThrow({ where: { id: params.data.id }, include: { post: { include: { fiscalYear: true } } } });
      if (current.post.fiscalYear.phase !== "PREPARATION") return NextResponse.json({ error: "Cet exercice n’est pas en préparation" }, { status: 409 });
      if (body.data.postId && body.data.postId !== current.postId) {
        const post = await tx.budgetPost.findUnique({ where: { id: body.data.postId } });
        if (!post || post.fiscalYearId !== current.post.fiscalYearId) return NextResponse.json({ error: "Choisissez un poste du même exercice" }, { status: 400 });
      }
      const revisedGross = body.data.revisedGross ?? Number(current.revisedGross);
      const revisedFederation = body.data.revisedFederation ?? Number(current.revisedFederation);
      validatePreparationAmounts({ revisedGross, revisedFederation });
      const season = body.data.plannedMonth === undefined ? {} : { seasonId: await preparationSeasonId(tx, current.post.fiscalYear.label, body.data.plannedMonth) };
      const action = await tx.budgetAction.update({ where: { id: current.id }, data: { ...body.data, ...season, revisedClubIncome: roundAmount(revisedGross - revisedFederation) } });
      return NextResponse.json(serializeBudgetAction(action));
    }, { isolationLevel: "Serializable" }), writeRoles);
  } catch (error) {
    if (error instanceof z.ZodError) return invalidDataResponse(error);
    return apiErrorResponse(error, "Impossible de modifier la proposition");
  }
}
export async function DELETE(_request: Request, context: Context) {
  const params = pilotageParamsSchema.safeParse(context.params);
  if (!params.success) return invalidDataResponse(params.error);
  try {
    return await runAsAuthenticatedUser(async () => prisma.$transaction(async tx => {
      const action = await tx.budgetAction.findUniqueOrThrow({ where: { id: params.data.id }, include: { post: { include: { fiscalYear: true } } } });
      if (action.post.fiscalYear.phase !== "PREPARATION") return NextResponse.json({ error: "Cet exercice n’est pas en préparation" }, { status: 409 });
      await tx.budgetAction.delete({ where: { id: action.id } });
      return NextResponse.json({ success: true });
    }, { isolationLevel: "Serializable" }), writeRoles);
  } catch (error) { return apiErrorResponse(error, "Impossible de supprimer la proposition"); }
}
