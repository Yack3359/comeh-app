import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { pilotageParamsSchema } from "@/lib/budget-pilotage-validations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: { id: string } }) {
  const params = pilotageParamsSchema.safeParse(context.params);
  if (!params.success) return invalidDataResponse(params.error);
  try {
    return await runAsAuthenticatedUser(async () => {
      const snapshot = await prisma.budgetSnapshot.findUnique({ where: { id: params.data.id }, include: { importedBy: { select: { name: true } } } });
      return snapshot ? NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } })
        : NextResponse.json({ error: "Situation budgétaire introuvable" }, { status: 404 });
    });
  } catch (error) { return apiErrorResponse(error, "Impossible de charger la situation budgétaire"); }
}
