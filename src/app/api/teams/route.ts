import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  seasonFilterSchema,
  teamCreateSchema,
} from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsedQuery = seasonFilterSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(() =>
      prisma.team.findMany({
        where: { seasonId: parsedQuery.data.seasonId },
        orderBy: [{ season: { startDate: "desc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          seasonId: true,
          season: {
            select: {
              label: true,
            },
          },
          _count: {
            select: { results: true },
          },
        },
      }),
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de charger les équipes");
  }
}

export async function POST(request: Request) {
  const parsedBody = teamCreateSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedBody.success) {
    return invalidDataResponse(parsedBody.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async () => {
        const season = await prisma.season.findUnique({
          where: { id: parsedBody.data.seasonId },
          select: { id: true },
        });
        if (!season) {
          return { status: "invalid_season" as const };
        }

        const team = await prisma.team.create({
          data: parsedBody.data,
          select: { id: true },
        });
        return { status: "created" as const, team };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }
    if (result.status === "invalid_season") {
      return NextResponse.json({ error: "Saison invalide" }, { status: 400 });
    }

    return NextResponse.json(result.team, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de créer l’équipe");
  }
}
