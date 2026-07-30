import {
  fencingCategories,
  type FencingCategoryValue,
} from "@/components/fencing-category";
import { prisma } from "@/lib/prisma";

function percentage(planned: number, spent: number) {
  return planned > 0 ? (spent / planned) * 100 : spent > 0 ? 100 : 0;
}

export async function getBudgetTracking(seasonId: string) {
  const [categories, expenseTotals, fiscalYears, expenses] = await Promise.all([
    prisma.budgetCategory.findMany({
      where: { seasonId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        budgets: {
          where: { seasonId },
          select: {
            fencingCategory: true,
            plannedAmount: true,
          },
        },
      },
    }),
    prisma.expense.groupBy({
      by: ["categoryId", "fencingCategory"],
      where: { seasonId },
      _sum: { amount: true },
    }),
    prisma.fiscalYear.findMany({
      where: { seasons: { some: { id: seasonId } } },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        label: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.expense.findMany({
      where: { seasonId },
      select: {
        amount: true,
        date: true,
      },
    }),
  ]);

  const spentByCategory = new Map<string, number>();
  expenseTotals.forEach((total) => {
    spentByCategory.set(
      total.categoryId,
      (spentByCategory.get(total.categoryId) ?? 0) +
        Number(total._sum.amount ?? 0),
    );
  });

  const rows = categories.map(({ budgets, ...category }) => {
    const globalBudgets = budgets.filter(
      (budget) => budget.fencingCategory === null,
    );
    const relevantBudgets =
      globalBudgets.length > 0
        ? globalBudgets
        : budgets.filter((budget) => budget.fencingCategory !== null);
    const planned = relevantBudgets.reduce(
      (total, budget) => total + Number(budget.plannedAmount),
      0,
    );
    const spent = spentByCategory.get(category.id) ?? 0;

    return {
      ...category,
      planned,
      spent,
      remaining: planned - spent,
      percentage: percentage(planned, spent),
    };
  });

  const planned = rows.reduce((total, row) => total + row.planned, 0);
  const spent = rows.reduce((total, row) => total + row.spent, 0);
  const presentFencingCategories = new Set<FencingCategoryValue>();

  categories.forEach((category) => {
    category.budgets.forEach((budget) => {
      if (budget.fencingCategory) {
        presentFencingCategories.add(budget.fencingCategory);
      }
    });
  });
  expenseTotals.forEach((expenseTotal) => {
    if (expenseTotal.fencingCategory) {
      presentFencingCategories.add(expenseTotal.fencingCategory);
    }
  });

  const fencingCategoryRows: Array<{
    fencingCategory: FencingCategoryValue | null;
    planned: number;
    spent: number;
    remaining: number;
    percentage: number;
  }> = fencingCategories
    .filter((fencingCategory) =>
      presentFencingCategories.has(fencingCategory),
    )
    .map((fencingCategory) => {
      const categoryPlanned = categories.reduce(
        (total, category) =>
          total +
          category.budgets.reduce(
            (categoryTotal, budget) =>
              budget.fencingCategory === fencingCategory
                ? categoryTotal + Number(budget.plannedAmount)
                : categoryTotal,
            0,
          ),
        0,
      );
      const categorySpent = expenseTotals.reduce(
        (total, expenseTotal) =>
          expenseTotal.fencingCategory === fencingCategory
            ? total + Number(expenseTotal._sum.amount ?? 0)
            : total,
        0,
      );

      return {
        fencingCategory,
        planned: categoryPlanned,
        spent: categorySpent,
        remaining: categoryPlanned - categorySpent,
        percentage: percentage(categoryPlanned, categorySpent),
      };
    });

  const unspecifiedSpent = expenseTotals.reduce(
    (total, expenseTotal) =>
      expenseTotal.fencingCategory === null
        ? total + Number(expenseTotal._sum.amount ?? 0)
        : total,
    0,
  );

  if (unspecifiedSpent > 0) {
    fencingCategoryRows.push({
      fencingCategory: null,
      planned: 0,
      spent: unspecifiedSpent,
      remaining: -unspecifiedSpent,
      percentage: 100,
    });
  }

  const spentByFiscalYear = fiscalYears.map((fiscalYear) => ({
    ...fiscalYear,
    spent: expenses.reduce(
      (total, expense) =>
        expense.date >= fiscalYear.startDate &&
        expense.date <= fiscalYear.endDate
          ? total + Number(expense.amount)
          : total,
      0,
    ),
  }));

  return {
    planned,
    spent,
    remaining: planned - spent,
    percentage: percentage(planned, spent),
    categories: rows,
    fencingCategories: fencingCategoryRows,
    fiscalYears: spentByFiscalYear,
  };
}
