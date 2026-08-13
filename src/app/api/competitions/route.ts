import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  competitionCreateSchema,
  seasonFilterSchema,
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
      prisma.competition.findMany({
        where: { seasonId: parsedQuery.data.seasonId },
        orderBy: [{ date: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          location: true,
          country: true,
          date: true,
          level: true,
          seasonId: true,
          weapon: true,
          gender: true,
          category: true,
          isSelective: true,
          season: { select: { label: true } },
          _count: { select: { results: true } },
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
    return apiErrorResponse(error, "Impossible de charger les compétitions");
  }
}

export async function POST(request: Request) {
  const parsedBody = competitionCreateSchema.safeParse(
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

        const competition = await prisma.competition.create({
          data: {
            ...parsedBody.data,
            date,
          },
          select: {
            id: true,
            weapon: true,
            gender: true,
            category: true,
            isSelective: true,
          },
        });
        return { status: "created" as const, competition };
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

    return NextResponse.json(result.competition, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de créer la compétition");
  }
}
