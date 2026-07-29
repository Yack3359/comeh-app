import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  athleteCategorySchema,
  entityParamsSchema,
  seasonFilterSchema,
} from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

type RouteContext = {
  params: { id: string };
};

export async function PUT(request: Request, context: RouteContext) {
  const parsedParams = entityParamsSchema.safeParse(context.params);
  const parsedBody = athleteCategorySchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }
  if (!parsedBody.success) {
    return invalidDataResponse(parsedBody.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async () => {
        const [athlete, season] = await Promise.all([
          prisma.athlete.findUnique({
            where: { id: parsedParams.data.id },
            select: { id: true },
          }),
          prisma.season.findUnique({
            where: { id: parsedBody.data.seasonId },
            select: { id: true },
          }),
        ]);

        if (!athlete || !season) {
          return { status: "invalid_relation" as const };
        }

        const category = await prisma.athleteCategorySeason.upsert({
          where: {
            athleteId_seasonId: {
              athleteId: athlete.id,
              seasonId: season.id,
            },
          },
          update: {
            category: parsedBody.data.category,
            rankingPoints: parsedBody.data.rankingPoints,
          },
          create: {
            athleteId: athlete.id,
            seasonId: season.id,
            category: parsedBody.data.category,
            rankingPoints: parsedBody.data.rankingPoints,
          },
          select: {
            athleteId: true,
            seasonId: true,
            category: true,
            rankingPoints: true,
          },
        });

        return { status: "saved" as const, category };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }
    if (result.status === "invalid_relation") {
      return NextResponse.json(
        { error: "L’athlète ou la saison sélectionnée est invalide" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ...result.category,
      rankingPoints:
        result.category.rankingPoints === null
          ? null
          : Number(result.category.rankingPoints),
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible d’enregistrer la catégorie");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const parsedParams = entityParamsSchema.safeParse(context.params);
  const parsedQuery = seasonFilterSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }
  if (!parsedQuery.success || !parsedQuery.data.seasonId) {
    return parsedQuery.success
      ? NextResponse.json({ error: "Saison requise" }, { status: 400 })
      : invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      () =>
        prisma.athleteCategorySeason.delete({
          where: {
            athleteId_seasonId: {
              athleteId: parsedParams.data.id,
              seasonId: parsedQuery.data.seasonId!,
            },
          },
        }),
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de supprimer la catégorie");
  }
}
