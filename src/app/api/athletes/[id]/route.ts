import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  athleteUpdateSchema,
  entityParamsSchema,
} from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  const parsedParams = entityParamsSchema.safeParse(context.params);
  const parsedBody = athleteUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }
  if (!parsedBody.success) {
    return invalidDataResponse(parsedBody.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      () =>
        prisma.athlete.update({
          where: { id: parsedParams.data.id },
          data: parsedBody.data,
          select: { id: true },
        }),
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Impossible de modifier l’athlète");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const parsedParams = entityParamsSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async () => {
        const athlete = await prisma.athlete.findUnique({
          where: { id: parsedParams.data.id },
          select: {
            id: true,
            _count: {
              select: {
                results: true,
                opponentResults: true,
              },
            },
          },
        });

        if (!athlete) {
          return { status: "not_found" as const };
        }

        if (athlete._count.results > 0 || athlete._count.opponentResults > 0) {
          return { status: "in_use" as const };
        }

        await prisma.athlete.delete({ where: { id: athlete.id } });
        return { status: "deleted" as const };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }
    if (result.status === "not_found") {
      return NextResponse.json({ error: "Athlète introuvable" }, { status: 404 });
    }
    if (result.status === "in_use") {
      return NextResponse.json(
        {
          error:
            "Cet athlète est lié à des résultats et ne peut pas être supprimé",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de supprimer l’athlète");
  }
}
