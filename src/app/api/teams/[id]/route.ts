import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  entityParamsSchema,
  teamUpdateSchema,
} from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  const parsedParams = entityParamsSchema.safeParse(context.params);
  const parsedBody = teamUpdateSchema.safeParse(
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
        const [season, mismatchedResults] = await Promise.all([
          prisma.season.findUnique({
            where: { id: parsedBody.data.seasonId },
            select: { id: true },
          }),
          prisma.result.count({
            where: {
              teamId: parsedParams.data.id,
              competition: {
                seasonId: { not: parsedBody.data.seasonId },
              },
            },
          }),
        ]);

        if (!season) {
          return { status: "invalid_season" as const };
        }
        if (mismatchedResults > 0) {
          return { status: "season_conflict" as const };
        }

        const team = await prisma.team.update({
          where: { id: parsedParams.data.id },
          data: parsedBody.data,
          select: { id: true },
        });
        return { status: "updated" as const, team };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }
    if (result.status === "invalid_season") {
      return NextResponse.json({ error: "Saison invalide" }, { status: 400 });
    }
    if (result.status === "season_conflict") {
      return NextResponse.json(
        { error: "Cette équipe possède des résultats dans une autre saison" },
        { status: 409 },
      );
    }

    return NextResponse.json(result.team);
  } catch (error) {
    return apiErrorResponse(error, "Impossible de modifier l’équipe");
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
        const team = await prisma.team.findUnique({
          where: { id: parsedParams.data.id },
          select: {
            id: true,
            _count: { select: { results: true } },
          },
        });
        if (!team) {
          return { status: "not_found" as const };
        }
        if (team._count.results > 0) {
          return { status: "in_use" as const };
        }
        await prisma.team.delete({ where: { id: team.id } });
        return { status: "deleted" as const };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }
    if (result.status === "not_found") {
      return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
    }
    if (result.status === "in_use") {
      return NextResponse.json(
        { error: "Cette équipe est liée à des résultats" },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de supprimer l’équipe");
  }
}
