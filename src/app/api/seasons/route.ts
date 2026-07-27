import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runAsAuthenticatedUser(() =>
      prisma.season.findMany({
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          label: true,
          startDate: true,
          endDate: true,
          fiscalYears: {
            orderBy: { startDate: "asc" },
            select: {
              id: true,
              label: true,
            },
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
    return apiErrorResponse(error, "Impossible de charger les saisons");
  }
}

