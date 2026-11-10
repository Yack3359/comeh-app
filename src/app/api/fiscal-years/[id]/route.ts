import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { pilotageParamsSchema } from "@/lib/budget-pilotage-validations";
import { fiscalYearUpdateSchema } from "@/lib/budget-preparation-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: { params: { id: string } }) {
  const params = pilotageParamsSchema.safeParse(context.params);
  const body = fiscalYearUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!params.success) return invalidDataResponse(params.error);
  if (!body.success) return invalidDataResponse(body.error);
  try {
    return await runAsAuthenticatedUser(async () => {
      const year = await prisma.fiscalYear.update({ where: { id: params.data.id }, data: { ...body.data, ...(body.data.preparationDeadline !== undefined ? { preparationDeadline: body.data.preparationDeadline === null ? null : new Date(body.data.preparationDeadline + "T00:00:00.000Z") } : {}) } });
      return NextResponse.json({ ...year, restitutionAmount: Number(year.restitutionAmount), targetFederation: year.targetFederation === null ? null : Number(year.targetFederation) });
    }, writeRoles);
  } catch (error) { return apiErrorResponse(error, "Impossible de modifier l’exercice"); }
}
