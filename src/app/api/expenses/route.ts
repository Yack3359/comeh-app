import { ExpenseSource, Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import {
  expenseCreateSchema,
  expenseQuerySchema,
} from "@/lib/budget-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsedQuery = expenseQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(async () => {
      const expenses = await prisma.expense.findMany({
        where: {
          seasonId: parsedQuery.data.seasonId,
          categoryId: parsedQuery.data.categoryId,
          competitionId: parsedQuery.data.competitionId,
          fencingCategory:
            parsedQuery.data.fencingCategory === "NONE"
              ? null
              : parsedQuery.data.fencingCategory,
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
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

      return expenses.map((expense) => ({
        ...expense,
        amount: expense.amount.toString(),
      }));
    });

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de charger les frais");
  }
}

export async function POST(request: Request) {
  const parsedBody = expenseCreateSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedBody.success) {
    return invalidDataResponse(parsedBody.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async (userId) => {
        const [season, category, competition] = await Promise.all([
          prisma.season.findUnique({
            where: { id: parsedBody.data.seasonId },
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

        if (!season || !category || category.seasonId !== season.id) {
          return { status: "invalid_relation" as const };
        }

        if (
          parsedBody.data.competitionId &&
          (!competition || competition.seasonId !== season.id)
        ) {
          return { status: "invalid_competition" as const };
        }

        const expenseDate = new Date(`${parsedBody.data.date}T00:00:00.000Z`);
        if (expenseDate < season.startDate || expenseDate > season.endDate) {
          return { status: "outside_season" as const };
        }

        const expense = await prisma.expense.create({
          data: {
            seasonId: season.id,
            categoryId: category.id,
            fencingCategory: parsedBody.data.fencingCategory,
            competitionId: parsedBody.data.competitionId,
            amount: parsedBody.data.amount,
            date: expenseDate,
            description: parsedBody.data.description,
            createdById: userId,
            source: ExpenseSource.MANUAL,
          },
          select: { id: true },
        });

        return { status: "created" as const, expense };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
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

    if (result.status === "outside_season") {
      return NextResponse.json(
        { error: "La date du frais doit être comprise dans la saison" },
        { status: 400 },
      );
    }

    return NextResponse.json(result.expense, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Impossible d’enregistrer le frais");
  }
}
