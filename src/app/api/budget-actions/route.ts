import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { inferredSeasonLabel } from "@/lib/budget-matrix-apply";
import { serializeBudgetAction } from "@/lib/budget-pilotage-data";
import { budgetActionCreateSchema } from "@/lib/budget-pilotage-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const body = budgetActionCreateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return invalidDataResponse(body.error);
  try {
    return await runAsAuthenticatedUser(async () => {
      const post = await prisma.budgetPost.findUnique({ where: { id: body.data.postId }, include: { fiscalYear: true } });
      if (!post) return NextResponse.json({ error: "Poste budgétaire introuvable" }, { status: 400 });
      const { status, ...data } = body.data;
      const includedInBudget = status !== "UNBUDGETED" && status !== "OPTION";
      const seasonLabel = inferredSeasonLabel(post.fiscalYear.label, data.plannedMonth ?? null);
      const season = seasonLabel ? await prisma.season.findUnique({ where: { label: seasonLabel }, select: { id: true } }) : null;
      const action = await prisma.budgetAction.create({ data: {
        ...data, status, includedInBudget, seasonId: season?.id ?? null,
        initialGross: includedInBudget ? data.revisedGross : 0,
        initialClubIncome: includedInBudget ? data.revisedClubIncome : 0,
        initialFederation: includedInBudget ? data.revisedFederation : 0,
      } });
      return NextResponse.json(serializeBudgetAction(action), { status: 201 });
    }, writeRoles);
  } catch (error) { return apiErrorResponse(error, "Impossible de créer l’action budgétaire"); }
}
