import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import {
  budgetUpdateSchema,
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
    const result = await runAsAuthenticatedUser(async () => {
      const categories = await prisma.budgetCategory.findMany({
        where: { seasonId: parsedQuery.data.seasonId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          budgets: {
            where: { seasonId: parsedQuery.data.seasonId },
            select: {
              id: true,
              plannedAmount: true,
            },
          },
        },
      });

      return categories.map(({ budgets, ...category }) => ({
        ...category,
        budgetId: budgets[0]?.id ?? null,
        plannedAmount: budgets[0]?.plannedAmount.toString() ?? "0.00",
      }));
    });

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de charger le budget");
  }
}

export async function PUT(request: Request) {
  const parsedBody = budgetUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedBody.success) {
    return invalidDataResponse(parsedBody.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async () => {
        const categoryIds = parsedBody.data.budgets.map(
          ({ categoryId }) => categoryId,
        );
        const validCategories = await prisma.budgetCategory.count({
          where: {
            seasonId: parsedBody.data.seasonId,
            id: { in: categoryIds },
          },
        });

        if (validCategories !== categoryIds.length) {
          return { status: "invalid_categories" as const };
        }

        for (const budget of parsedBody.data.budgets) {
          await prisma.budget.upsert({
            where: {
              seasonId_categoryId: {
                seasonId: parsedBody.data.seasonId,
                categoryId: budget.categoryId,
              },
            },
            update: {
              plannedAmount: budget.plannedAmount,
            },
            create: {
              seasonId: parsedBody.data.seasonId,
              categoryId: budget.categoryId,
              plannedAmount: budget.plannedAmount,
            },
          });
        }

        return { status: "updated" as const };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status === "invalid_categories") {
      return NextResponse.json(
        { error: "Une catégorie ne correspond pas à la saison sélectionnée" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Impossible d’enregistrer le budget");
  }
}

