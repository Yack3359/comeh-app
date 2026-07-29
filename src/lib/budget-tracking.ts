import { prisma } from "@/lib/prisma";

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
          select: { plannedAmount: true },
        },
      },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
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
    percentage: planned > 0 ? (spent / planned) * 100 : spent > 0 ? 100 : 0,
    categories: rows,
    fiscalYears: spentByFiscalYear,
  };
}
