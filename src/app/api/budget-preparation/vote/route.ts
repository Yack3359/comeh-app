import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { voteOutcome } from "@/lib/budget-preparation";
import { serializeBudgetAction } from "@/lib/budget-pilotage-data";
import { preparationVoteSchema } from "@/lib/budget-preparation-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const body = preparationVoteSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return invalidDataResponse(body.error);
  try {
    return await runAsAuthenticatedUser(async () => prisma.$transaction(async tx => {
      const year = await tx.fiscalYear.findUniqueOrThrow({ where: { label: body.data.fiscalYearLabel } });
      if (year.phase !== "PREPARATION") return NextResponse.json({ error: "Cet exercice n’est pas en préparation" }, { status: 409 });
      const lines = await tx.budgetAction.findMany({ where: { post: { fiscalYearId: year.id } } });
      const pending = lines.filter(line => line.proposalStatus === "PROPOSED" || line.proposalStatus === null).length;
      const arbitration = lines.filter(line => line.proposalStatus === "ARBITRATION").length;
      if (!body.data.keepPending && (pending || arbitration)) return NextResponse.json({ error: "Des lignes restent à confirmer ou à arbitrer", pending, arbitration }, { status: 409 });
      for (const line of lines) await tx.budgetAction.update({ where: { id: line.id }, data: voteOutcome(line.proposalStatus, serializeBudgetAction(line)) });
      await tx.fiscalYear.update({ where: { id: year.id }, data: { phase: "EXECUTION" } });
      return NextResponse.json({ success: true });
    }, { isolationLevel: "Serializable" }), writeRoles);
  } catch (error) { return apiErrorResponse(error, "Impossible de voter le budget"); }
}
