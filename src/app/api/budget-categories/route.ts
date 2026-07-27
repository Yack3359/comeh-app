import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import {
  budgetCategoryCreateSchema,
  seasonQuerySchema,
} from "@/lib/budget-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

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
      prisma.budgetCategory.findMany({
        where: { seasonId: parsedQuery.data.seasonId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          seasonId: true,
          _count: {
            select: {
              budgets: true,
              expenses: true,
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
    return apiErrorResponse(error, "Impossible de charger les catégories");
  }
}

export async function POST(request: Request) {
  const parsedBody = budgetCategoryCreateSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedBody.success) {
    return invalidDataResponse(parsedBody.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      () =>
        prisma.budgetCategory.create({
          data: parsedBody.data,
          select: {
            id: true,
            name: true,
            seasonId: true,
          },
        }),
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de créer la catégorie");
  }
}

