import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { selectionHelperQuerySchema } from "@/lib/rankings-validations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsedQuery = selectionHelperQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(async () => {
      const { seasonId, category, weapon, gender } = parsedQuery.data;
      const categoryAthletes =
        await prisma.athleteCategorySeason.findMany({
          where: {
            seasonId,
            category,
            athlete: { gender },
          },
          select: {
            rankingPoints: true,
            selectionCriteria: true,
            athlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                club: true,
                country: true,
                results: {
                  where: {
                    competition: {
                      seasonId,
                      weapon,
                      gender,
                    },
                  },
                  select: {
                    competitionId: true,
                    rank: true,
                    opponentAthleteId: true,
                    won: true,
                  },
                },
              },
            },
          },
        });

      return categoryAthletes
        .map(({ athlete, rankingPoints, selectionCriteria }) => {
          const competitions = new Set(
            athlete.results.map((item) => item.competitionId),
          );
          const ranks = athlete.results.flatMap((item) =>
            item.rank === null ? [] : [item.rank],
          );
          const bouts = athlete.results.filter(
            (item) =>
              item.opponentAthleteId !== null && item.won !== null,
          );
          const wins = bouts.filter((item) => item.won).length;

          return {
            athleteId: athlete.id,
            firstName: athlete.firstName,
            lastName: athlete.lastName,
            club: athlete.club,
            country: athlete.country,
            rankingPoints:
              rankingPoints === null ? null : Number(rankingPoints),
            selectionCriteria,
            competitionCount: competitions.size,
            bestRank: ranks.length > 0 ? Math.min(...ranks) : null,
            boutCount: bouts.length,
            wins,
            winRate: bouts.length > 0 ? (wins / bouts.length) * 100 : 0,
          };
        })
        .sort((left, right) => {
          if (
            left.rankingPoints !== null ||
            right.rankingPoints !== null
          ) {
            if (left.rankingPoints === null) {
              return 1;
            }
            if (right.rankingPoints === null) {
              return -1;
            }
            if (right.rankingPoints !== left.rankingPoints) {
              return right.rankingPoints - left.rankingPoints;
            }
          }
          if (right.winRate !== left.winRate) {
            return right.winRate - left.winRate;
          }
          return (
            left.lastName.localeCompare(right.lastName, "fr") ||
            left.firstName.localeCompare(right.firstName, "fr")
          );
        });
    });

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Impossible de préparer l’aide à la sélection",
    );
  }
}
