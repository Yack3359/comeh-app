import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { pilotageParamsSchema, restitutionUpdateSchema } from "@/lib/budget-pilotage-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: { params: { id: string } }) {
  const params = pilotageParamsSchema.safeParse(context.params);
  const body = restitutionUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!params.success) return invalidDataResponse(params.error);
  if (!body.success) return invalidDataResponse(body.error);
  try {
    return await runAsAuthenticatedUser(async () => {
      const year = await prisma.fiscalYear.update({ where: { id: params.data.id }, data: body.data });
      return NextResponse.json({ ...year, restitutionAmount: Number(year.restitutionAmount) });
    }, writeRoles);
  } catch (error) { return apiErrorResponse(error, "Impossible de modifier la restitution de l’exercice"); }
}
