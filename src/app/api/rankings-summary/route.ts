import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { seasonQuerySchema } from "@/lib/budget-validations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsedQuery = seasonQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(async () => {
      const [activeAthletes, competitions, results] = await Promise.all([
        prisma.athleteCategorySeason.count({
          where: { seasonId: parsedQuery.data.seasonId },
        }),
        prisma.competition.count({
          where: { seasonId: parsedQuery.data.seasonId },
        }),
        prisma.result.count({
          where: {
            competition: { seasonId: parsedQuery.data.seasonId },
          },
        }),
      ]);

      return { activeAthletes, competitions, results };
    });

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de charger la synthèse rankings");
  }
}
