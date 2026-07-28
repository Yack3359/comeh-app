import { NextResponse } from "next/server";

import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { getBudgetTracking } from "@/lib/budget-tracking";
import { seasonQuerySchema } from "@/lib/budget-validations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsedQuery = seasonQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(() =>
      getBudgetTracking(parsedQuery.data.seasonId),
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de calculer le suivi budgétaire");
  }
}
