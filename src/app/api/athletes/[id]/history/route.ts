import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  athleteHistoryQuerySchema,
  entityParamsSchema,
} from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: { id: string };
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  const parsedParams = entityParamsSchema.safeParse(context.params);
  const parsedQuery = athleteHistoryQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }
  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(async () => {
      const athlete = await prisma.athlete.findUnique({
        where: { id: parsedParams.data.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          categorySeasons: {
            orderBy: { season: { startDate: "desc" } },
            select: {
              category: true,
              season: {
                select: {
                  id: true,
                  label: true,
                  startDate: true,
                  endDate: true,
                },
              },
            },
          },
          results: {
            where: {
              opponentAthleteId: null,
              rank: { not: null },
              competition: {
                weapon: parsedQuery.data.weapon,
                gender: parsedQuery.data.gender,
                OR: parsedQuery.data.categoryExclude
                  ? [
                      { category: null },
                      {
                        category: {
                          not: parsedQuery.data.categoryExclude,
                        },
                      },
                    ]
                  : undefined,
              },
            },
            orderBy: { competition: { date: "desc" } },
            select: {
              id: true,
              rank: true,
              seedRank: true,
              poolRank: true,
              competition: {
                select: {
                  id: true,
                  name: true,
                  date: true,
                  level: true,
                  season: {
                    select: {
                      id: true,
                      label: true,
                      startDate: true,
                      endDate: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!athlete) {
        return null;
      }

      const seasonMap = new Map<
        string,
        {
          id: string;
          label: string;
          startDate: Date;
          endDate: Date;
          category: string | null;
          rankings: typeof athlete.results;
        }
      >();

      for (const item of athlete.categorySeasons) {
        seasonMap.set(item.season.id, {
          ...item.season,
          category: item.category,
          rankings: [],
        });
      }
      for (const ranking of athlete.results) {
        const season = ranking.competition.season;
        const row = seasonMap.get(season.id) ?? {
          ...season,
          category: null,
          rankings: [],
        };
        row.rankings.push(ranking);
        seasonMap.set(season.id, row);
      }

      return {
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        seasons: Array.from(seasonMap.values()).sort(
          (left, right) => right.startDate.getTime() - left.startDate.getTime(),
        ),
      };
    });

    if (result instanceof NextResponse) {
      return result;
    }
    if (!result) {
      return NextResponse.json({ error: "Athlète introuvable" }, { status: 404 });
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de charger l’historique");
  }
}
