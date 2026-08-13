import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { rankingIdSchema } from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

const paramsSchema = z.object({
  id: rankingIdSchema,
  athleteId: rankingIdSchema,
});

type RouteContext = {
  params: { id: string; athleteId: string };
};

export async function DELETE(_request: Request, context: RouteContext) {
  const parsedParams = paramsSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async () => {
        const member = await prisma.teamMember.findUnique({
          where: {
            teamId_athleteId: {
              teamId: parsedParams.data.id,
              athleteId: parsedParams.data.athleteId,
            },
          },
          select: { id: true },
        });
        if (!member) {
          return { status: "not_found" as const };
        }
        await prisma.teamMember.delete({ where: { id: member.id } });
        return { status: "deleted" as const };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }
    if (result.status === "not_found") {
      return NextResponse.json(
        { error: "Ce tireur ne fait pas partie de l’équipe" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Impossible de retirer ce tireur de l’équipe",
    );
  }
}
