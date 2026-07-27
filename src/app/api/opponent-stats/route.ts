import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { opponentStatsQuerySchema } from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsedQuery = opponentStatsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(async () => {
      const { athleteId, seasonId, groupBy, ...filters } = parsedQuery.data;
      const bouts = await prisma.result.findMany({
        where: {
          athleteId,
          opponentAthleteId: { not: null },
          won: { not: null },
          competition: seasonId ? { seasonId } : undefined,
          opponentAthlete: {
            country: filters.country,
            handedness: filters.handedness,
            gripType: filters.gripType,
            playStyle: filters.playStyle,
          },
        },
        select: {
          won: true,
          opponentAthlete: {
            select: {
              country: true,
              handedness: true,
              gripType: true,
              playStyle: true,
            },
          },
        },
      });

      const grouped = new Map<
        string,
        { key: string; wins: number; losses: number; total: number }
      >();

      for (const bout of bouts) {
        const key = bout.opponentAthlete?.[groupBy] ?? "UNKNOWN";
        const row = grouped.get(key) ?? {
          key,
          wins: 0,
          losses: 0,
          total: 0,
        };
        row.total += 1;
        if (bout.won) {
          row.wins += 1;
        } else {
          row.losses += 1;
        }
        grouped.set(key, row);
      }

      const groups = Array.from(grouped.values())
        .map((row) => ({
          ...row,
          winRate: row.total > 0 ? (row.wins / row.total) * 100 : 0,
        }))
        .sort((left, right) => {
          if (right.total !== left.total) {
            return right.total - left.total;
          }
          return right.winRate - left.winRate;
        });
      const wins = groups.reduce((sum, row) => sum + row.wins, 0);
      const losses = groups.reduce((sum, row) => sum + row.losses, 0);
      const total = wins + losses;

      return {
        groupBy,
        total,
        wins,
        losses,
        winRate: total > 0 ? (wins / total) * 100 : 0,
        groups,
      };
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
      "Impossible de calculer les statistiques adversaires",
    );
  }
}
