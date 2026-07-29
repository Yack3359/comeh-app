import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  competitionUpdateSchema,
  entityParamsSchema,
} from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  const parsedParams = entityParamsSchema.safeParse(context.params);
  const parsedBody = competitionUpdateSchema.safeParse(
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
      async () => {
        const season = await prisma.season.findUnique({
          where: { id: parsedBody.data.seasonId },
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
        });
        if (!season) {
          return { status: "invalid_season" as const };
        }

        const date = new Date(`${parsedBody.data.date}T00:00:00.000Z`);
        if (date < season.startDate || date > season.endDate) {
          return { status: "outside_season" as const };
        }

        const mismatchedTeams = await prisma.result.count({
          where: {
            competitionId: parsedParams.data.id,
            team: {
              seasonId: { not: season.id },
            },
          },
        });
        if (mismatchedTeams > 0) {
          return { status: "team_conflict" as const };
        }

        const competition = await prisma.competition.update({
          where: { id: parsedParams.data.id },
          data: {
            ...parsedBody.data,
            date,
          },
          select: {
            id: true,
            weapon: true,
            gender: true,
            category: true,
          },
        });
        return { status: "updated" as const, competition };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }
    if (result.status === "invalid_season") {
      return NextResponse.json({ error: "Saison invalide" }, { status: 400 });
    }
    if (result.status === "outside_season") {
      return NextResponse.json(
        { error: "La date doit être comprise dans la saison" },
        { status: 400 },
      );
    }
    if (result.status === "team_conflict") {
      return NextResponse.json(
        { error: "Une équipe liée appartient à une autre saison" },
        { status: 409 },
      );
    }

    return NextResponse.json(result.competition);
  } catch (error) {
    return apiErrorResponse(error, "Impossible de modifier la compétition");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const parsedParams = entityParamsSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      () =>
        prisma.competition.delete({
          where: { id: parsedParams.data.id },
          select: { id: true },
        }),
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de supprimer la compétition");
  }
}
