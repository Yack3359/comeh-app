import { NextResponse } from "next/server";

import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
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
      const [categories, expenseTotals] = await Promise.all([
        prisma.budgetCategory.findMany({
          where: { seasonId: parsedQuery.data.seasonId },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            budgets: {
              where: { seasonId: parsedQuery.data.seasonId },
              select: { plannedAmount: true },
            },
          },
        }),
        prisma.expense.groupBy({
          by: ["categoryId"],
          where: { seasonId: parsedQuery.data.seasonId },
          _sum: { amount: true },
        }),
      ]);
      const spentByCategory = new Map(
        expenseTotals.map((total) => [
          total.categoryId,
          Number(total._sum.amount ?? 0),
        ]),
      );

      const rows = categories.map(({ budgets, ...category }) => {
        const planned = Number(budgets[0]?.plannedAmount ?? 0);
        const spent = spentByCategory.get(category.id) ?? 0;

        return {
          ...category,
          planned,
          spent,
          remaining: planned - spent,
          percentage: planned > 0 ? (spent / planned) * 100 : spent > 0 ? 100 : 0,
        };
      });

      const planned = rows.reduce((total, row) => total + row.planned, 0);
      const spent = rows.reduce((total, row) => total + row.spent, 0);

      return {
        planned,
        spent,
        remaining: planned - spent,
        percentage: planned > 0 ? (spent / planned) * 100 : spent > 0 ? 100 : 0,
        categories: rows,
      };
    });

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
