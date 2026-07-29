import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  resultRelationError,
  toResultData,
  validateResultRelations,
} from "@/lib/ranking-results";
import {
  resultCreateSchema,
  resultQuerySchema,
} from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsedQuery = resultQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(async () => {
      const results = await prisma.result.findMany({
        where: {
          competitionId: parsedQuery.data.competitionId,
          athleteId: parsedQuery.data.athleteId,
          competition: {
            seasonId: parsedQuery.data.seasonId,
            weapon: parsedQuery.data.weapon,
            gender: parsedQuery.data.gender,
            OR: parsedQuery.data.categoryExclude
              ? [
                  { category: null },
                  { category: { not: parsedQuery.data.categoryExclude } },
                ]
              : undefined,
          },
        },
        orderBy: [
          { competition: { date: "desc" } },
          { rank: { sort: "asc", nulls: "last" } },
          { id: "desc" },
        ],
        select: {
          id: true,
          competitionId: true,
          athleteId: true,
          teamId: true,
          opponentAthleteId: true,
          rank: true,
          score: true,
          round: true,
          won: true,
          competition: {
            select: {
              name: true,
              date: true,
              seasonId: true,
              weapon: true,
              gender: true,
              category: true,
              season: { select: { label: true } },
            },
          },
          athlete: {
            select: { firstName: true, lastName: true },
          },
          team: {
            select: { name: true },
          },
          opponentAthlete: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      return results.map((item) => ({
        ...item,
        type: item.opponentAthleteId ? ("bout" as const) : ("ranking" as const),
        participantType: item.teamId ? ("team" as const) : ("athlete" as const),
      }));
    });

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de charger les résultats");
  }
}

export async function POST(request: Request) {
  const parsedBody = resultCreateSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedBody.success) {
    return invalidDataResponse(parsedBody.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async () => {
        const relationStatus = await validateResultRelations(parsedBody.data);
        if (relationStatus !== "valid") {
          return { status: relationStatus };
        }

        const created = await prisma.result.create({
          data: toResultData(parsedBody.data),
          select: { id: true },
        });
        return { status: "created" as const, result: created };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status !== "created") {
      const relationError = resultRelationError(result.status);
      return NextResponse.json(
        { error: relationError ?? "Relations invalides" },
        { status: 400 },
      );
    }

    return NextResponse.json(result.result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Impossible d’enregistrer le résultat");
  }
}
