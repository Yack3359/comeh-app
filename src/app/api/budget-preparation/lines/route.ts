import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { roundAmount } from "@/lib/budget-matrix";
import { serializeBudgetAction } from "@/lib/budget-pilotage-data";
import { preparationSeasonId } from "@/lib/budget-preparation-query";
import { preparationCreateSchema } from "@/lib/budget-preparation-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER, Role.CONTRIBUTOR] as const;
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const body = preparationCreateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return invalidDataResponse(body.error);
  try {
    return await runAsAuthenticatedUser(async userId => prisma.$transaction(async tx => {
      const post = await tx.budgetPost.findUnique({ where: { id: body.data.postId }, include: { fiscalYear: true } });
      if (!post) return NextResponse.json({ error: "Poste budgétaire introuvable" }, { status: 400 });
      if (post.fiscalYear.phase !== "PREPARATION") return NextResponse.json({ error: "Cet exercice n’est pas en préparation" }, { status: 409 });
      const last = await tx.budgetAction.aggregate({ where: { postId: post.id }, _max: { sortOrder: true } });
      const sortOrder = (last._max.sortOrder ?? 0) + 10;
      const seasonId = await preparationSeasonId(tx, post.fiscalYear.label, body.data.plannedMonth);
      const action = await tx.budgetAction.create({ data: { ...body.data, sortOrder, seasonId, revisedClubIncome: roundAmount(body.data.revisedGross - body.data.revisedFederation),
        proposedById: userId, origin: "NEW", status: "OPTION", includedInBudget: false, initialGross: 0, initialClubIncome: 0, initialFederation: 0 } });
      return NextResponse.json(serializeBudgetAction(action), { status: 201 });
    }, { isolationLevel: "Serializable" }), writeRoles);
  } catch (error) { return apiErrorResponse(error, "Impossible de créer la proposition"); }
}
