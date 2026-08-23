import { NextResponse } from "next/server";

import { fencingCategoryLabels } from "@/components/fencing-category";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const FORMULA_TRIGGER_CHARS = ["=", "+", "-", "@", "\t", "\r"];

function quoteCsvCell(text: string) {
  return `"${text.replaceAll('"', '""')}"`;
}

function csvNumberCell(value: number) {
  return quoteCsvCell(
    value.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    }),
  );
}

function csvTextCell(value: string) {
  const isFormulaTrigger = FORMULA_TRIGGER_CHARS.some((prefix) =>
    value.startsWith(prefix),
  );
  return quoteCsvCell(isFormulaTrigger ? `'${value}` : value);
}

export async function GET() {
  try {
    const result = await runAsAuthenticatedUser(async () => {
      const [expenses, budgets] = await Promise.all([
        prisma.expense.findMany({
          orderBy: [{ season: { startDate: "asc" } }, { date: "asc" }],
          select: {
            date: true,
            description: true,
            amount: true,
            fencingCategory: true,
            category: { select: { name: true } },
            competition: { select: { name: true } },
            season: { select: { label: true } },
            createdBy: { select: { name: true } },
          },
        }),
        prisma.budget.findMany({
          orderBy: [{ season: { startDate: "asc" } }],
          select: {
            plannedAmount: true,
            fencingCategory: true,
            category: { select: { name: true } },
            season: { select: { label: true } },
          },
        }),
      ]);

      return { expenses, budgets };
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const headerRow = [
      "Saison",
      "Type",
      "Catégorie",
      "Catégorie de tireur",
      "Compétition",
      "Détail",
      "Montant",
      "Saisi par",
    ].map(csvTextCell);
    const expenseRows = result.expenses.map((expense) => [
      csvTextCell(expense.season.label),
      csvTextCell("Dépense"),
      csvTextCell(expense.category.name),
      csvTextCell(
        expense.fencingCategory
          ? fencingCategoryLabels[expense.fencingCategory]
          : "Non spécifiée",
      ),
      csvTextCell(expense.competition?.name ?? ""),
      csvTextCell(expense.description),
      csvNumberCell(Number(expense.amount)),
      csvTextCell(expense.createdBy.name),
    ]);
    const budgetRows = result.budgets.map((budget) => [
      csvTextCell(budget.season.label),
      csvTextCell("Budget prévisionnel"),
      csvTextCell(budget.category.name),
      csvTextCell(
        budget.fencingCategory
          ? fencingCategoryLabels[budget.fencingCategory]
          : "Non spécifiée",
      ),
      csvTextCell(""),
      csvTextCell(""),
      csvNumberCell(Number(budget.plannedAmount)),
      csvTextCell(""),
    ]);
    const csv = `\uFEFF${[headerRow, ...expenseRows, ...budgetRows]
      .map((row) => row.join(";"))
      .join("\r\n")}\r\n`;

    return new NextResponse(csv, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition":
          'attachment; filename="frais-budget-complet.csv"',
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Impossible d’exporter les frais et budgets",
    );
  }
}
