import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { preparationReopenSchema } from "@/lib/budget-preparation-validations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const body = preparationReopenSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return invalidDataResponse(body.error);
  try {
    return await runAsAuthenticatedUser(async () => prisma.$transaction(async tx => {
      const year = await tx.fiscalYear.findUniqueOrThrow({ where: { label: body.data.fiscalYearLabel }, include: { _count: { select: { budgetSnapshots: true } } } });
      if (year.phase === "PREPARATION") return NextResponse.json({ error: "Cet exercice est déjà en préparation" }, { status: 409 });
      if (year._count.budgetSnapshots) return NextResponse.json({ error: "Impossible de rouvrir un exercice ayant déjà un import" }, { status: 409 });
      await tx.budgetAction.updateMany({ where: { post: { fiscalYearId: year.id } }, data: { status: "OPTION", includedInBudget: false, initialGross: 0, initialClubIncome: 0, initialFederation: 0 } });
      await tx.fiscalYear.update({ where: { id: year.id }, data: { phase: "PREPARATION" } });
      return NextResponse.json({ success: true });
    }, { isolationLevel: "Serializable" }), [Role.ADMIN]);
  } catch (error) { return apiErrorResponse(error, "Impossible de rouvrir la préparation"); }
}
