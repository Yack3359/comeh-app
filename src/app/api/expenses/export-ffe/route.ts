import { NextResponse } from "next/server";
import { z } from "zod";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { buildFfeExpenseReportWorkbook } from "@/lib/ffe-export";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  competitionId: z
    .string()
    .trim()
    .min(1, "Identifiant requis")
    .max(64),
});

export async function GET(request: Request) {
  const parsedQuery = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(async () => {
      const competitionId = parsedQuery.data.competitionId;
      const [competition, groupedExpenses] = await Promise.all([
        prisma.competition.findUnique({
          where: { id: competitionId },
          select: {
            name: true,
            location: true,
            date: true,
            isSelective: true,
          },
        }),
        prisma.expense.groupBy({
          by: ["categoryId"],
          where: { competitionId },
          _sum: { amount: true },
        }),
      ]);

      if (!competition) {
        return { competition: null };
      }

      const categories = await prisma.budgetCategory.findMany({
        where: {
          id: { in: groupedExpenses.map(({ categoryId }) => categoryId) },
        },
        select: { id: true, name: true },
      });
      const categoryNamesById = new Map(
        categories.map(({ id, name }) => [id, name]),
      );
      const amountsByCategory: Record<string, number> = {};

      for (const expense of groupedExpenses) {
        const categoryName = categoryNamesById.get(expense.categoryId);
        if (!categoryName) {
          continue;
        }

        amountsByCategory[categoryName] =
          (amountsByCategory[categoryName] ?? 0) +
          Number(expense._sum.amount ?? 0);
      }

      return { competition, amountsByCategory };
    });

    if (result instanceof NextResponse) {
      return result;
    }

    if (!result.competition) {
      return NextResponse.json(
        { error: "Compétition introuvable" },
        { status: 404 },
      );
    }

    const competitionName = result.competition.isSelective
      ? `Coupe du Monde ${result.competition.name}`
      : result.competition.name;
    const buffer = buildFfeExpenseReportWorkbook({
      competitionName,
      location: result.competition.location,
      date: result.competition.date,
      amountsByCategory: result.amountsByCategory,
    });
    const safeCompetitionName = result.competition.name.replace(
      /[^a-zA-Z0-9_-]+/g,
      "-",
    );

    return new NextResponse(buffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="NDF-${safeCompetitionName}.xlsx"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible d’exporter la note de frais FFE");
  }
}
