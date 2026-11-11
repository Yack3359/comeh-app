import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { expenseUpdateSchema } from "@/lib/budget-validations";
import { resolveExpenseAction } from "@/lib/expense-action";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
const paramsSchema = z.object({ id: z.string().trim().min(1).max(64) });

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(request: Request, context: RouteContext) {
  const parsedParams = paramsSchema.safeParse(context.params);
  const parsedBody = expenseUpdateSchema.safeParse(
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
        const existingExpense = await prisma.expense.findUnique({
          where: { id: parsedParams.data.id },
          select: {
            id: true,
            seasonId: true,
            competitionId: true,
            budgetActionId: true,
          },
        });

        if (!existingExpense) {
          return { status: "not_found" as const };
        }

        const [season, category, competition] = await Promise.all([
          prisma.season.findUnique({
            where: { id: existingExpense.seasonId },
            select: {
              id: true,
              startDate: true,
              endDate: true,
            },
          }),
          prisma.budgetCategory.findUnique({
            where: { id: parsedBody.data.categoryId },
            select: {
              id: true,
              seasonId: true,
            },
          }),
          parsedBody.data.competitionId
            ? prisma.competition.findUnique({
                where: { id: parsedBody.data.competitionId },
                select: { id: true, seasonId: true },
              })
            : Promise.resolve(null),
        ]);

        if (
          !season ||
          !category ||
          category.seasonId !== existingExpense.seasonId
        ) {
          return { status: "invalid_relation" as const };
        }

        if (
          parsedBody.data.competitionId &&
          (!competition || competition.seasonId !== existingExpense.seasonId)
        ) {
          return { status: "invalid_competition" as const };
        }

        const expenseDate = new Date(`${parsedBody.data.date}T00:00:00.000Z`);
        if (expenseDate < season.startDate || expenseDate > season.endDate) {
          return { status: "outside_season" as const };
        }

        const action =
          parsedBody.data.budgetActionId === undefined &&
          parsedBody.data.competitionId === existingExpense.competitionId
            ? {
                ok: true as const,
                budgetActionId: existingExpense.budgetActionId,
              }
            : await resolveExpenseAction(prisma, {
                requested: parsedBody.data.budgetActionId,
                competitionId: parsedBody.data.competitionId,
                date: parsedBody.data.date,
              });
        if (!action.ok) {
          return { status: "invalid_action" as const };
        }

        const expense = await prisma.expense.update({
          where: { id: existingExpense.id },
          data: {
            categoryId: parsedBody.data.categoryId,
            fencingCategory: parsedBody.data.fencingCategory,
            competitionId: parsedBody.data.competitionId,
            budgetActionId: action.budgetActionId,
            amount: parsedBody.data.amount,
            date: expenseDate,
            description: parsedBody.data.description,
          },
          select: {
            id: true,
            seasonId: true,
            categoryId: true,
            fencingCategory: true,
            amount: true,
            date: true,
            description: true,
            source: true,
            attachmentUrl: true,
            competitionId: true,
            budgetActionId: true,
            budgetAction: {
              select: {
                id: true,
                label: true,
                post: {
                  select: {
                    code: true,
                    fiscalYear: { select: { label: true } },
                  },
                },
              },
            },
            category: {
              select: { name: true },
            },
            season: {
              select: { label: true },
            },
            competition: {
              select: { id: true, name: true, location: true, date: true },
            },
            createdBy: {
              select: { name: true },
            },
          },
        });

        return {
          status: "updated" as const,
          expense: {
            ...expense,
            amount: expense.amount.toString(),
          },
        };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Frais introuvable" }, { status: 404 });
    }

    if (result.status === "invalid_relation") {
      return NextResponse.json(
        { error: "La saison ou la catégorie sélectionnée est invalide" },
        { status: 400 },
      );
    }

    if (result.status === "invalid_competition") {
      return NextResponse.json(
        { error: "La compétition sélectionnée n’appartient pas à cette saison" },
        { status: 400 },
      );
    }

    if (result.status === "invalid_action") {
      return NextResponse.json(
        {
          error:
            "L’action budgétaire sélectionnée est introuvable ou son budget n’est pas encore voté",
        },
        { status: 400 },
      );
    }

    if (result.status === "outside_season") {
      return NextResponse.json(
        { error: "La date du frais doit être comprise dans la saison" },
        { status: 400 },
      );
    }

    return NextResponse.json(result.expense);
  } catch (error) {
    return apiErrorResponse(error, "Impossible de modifier le frais");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const parsedParams = paramsSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async () => {
        const expense = await prisma.expense.findUnique({
          where: { id: parsedParams.data.id },
          select: { id: true },
        });

        if (!expense) {
          return { status: "not_found" as const };
        }

        await prisma.expense.delete({ where: { id: expense.id } });

        return { status: "deleted" as const };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Frais introuvable" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de supprimer le frais");
  }
}
