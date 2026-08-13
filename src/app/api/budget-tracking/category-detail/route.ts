import { FencingCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { getBudgetTrackingByFencingCategory } from "@/lib/budget-tracking";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  seasonId: z.string().trim().min(1),
  fencingCategory: z.nativeEnum(FencingCategory),
});

export async function GET(request: Request) {
  const parsedQuery = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(() =>
      getBudgetTrackingByFencingCategory(
        parsedQuery.data.seasonId,
        parsedQuery.data.fencingCategory,
      ),
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de calculer ce détail budgétaire");
  }
}
