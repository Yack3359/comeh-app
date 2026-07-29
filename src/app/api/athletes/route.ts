import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  athleteCreateSchema,
  athleteQuerySchema,
} from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsedQuery = athleteQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(() =>
      prisma.athlete.findMany({
        where: parsedQuery.data.search
          ? {
              OR: [
                {
                  firstName: {
                    contains: parsedQuery.data.search,
                    mode: "insensitive",
                  },
                },
                {
                  lastName: {
                    contains: parsedQuery.data.search,
                    mode: "insensitive",
                  },
                },
                {
                  club: {
                    contains: parsedQuery.data.search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : undefined,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gender: true,
          country: true,
          handedness: true,
          gripType: true,
          playStyle: true,
          club: true,
          categorySeasons: {
            orderBy: { season: { startDate: "desc" } },
            select: {
              seasonId: true,
              category: true,
              rankingPoints: true,
              season: {
                select: {
                  label: true,
                  startDate: true,
                },
              },
            },
          },
          _count: {
            select: {
              results: true,
              opponentResults: true,
            },
          },
        },
      }),
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(
      result.map((athlete) => ({
        ...athlete,
        categorySeasons: athlete.categorySeasons.map((item) => ({
          ...item,
          rankingPoints:
            item.rankingPoints === null ? null : Number(item.rankingPoints),
        })),
      })),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return apiErrorResponse(error, "Impossible de charger les athlètes");
  }
}

export async function POST(request: Request) {
  const parsedBody = athleteCreateSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedBody.success) {
    return invalidDataResponse(parsedBody.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      () =>
        prisma.athlete.create({
          data: parsedBody.data,
          select: { id: true },
        }),
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de créer l’athlète");
  }
}
