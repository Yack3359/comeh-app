import { NextResponse } from "next/server";

import { fencingCategoryLabels } from "@/components/fencing-category";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { seasonQuerySchema } from "@/lib/budget-validations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const FORMULA_TRIGGER_CHARS = ["=", "+", "-", "@", "\t", "\r"];

function quoteCsvCell(text: string) {
  return `"${text.replaceAll('"', '""')}"`;
}

/** Colonnes numériques calculées côté serveur : jamais de texte arbitraire, pas de risque d'injection de formule. */
function csvNumberCell(value: number) {
  return quoteCsvCell(
    value.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    }),
  );
}

/** Texte saisi librement par les utilisateurs : neutralise l'injection de formule Excel. */
function csvTextCell(value: string) {
  const isFormulaTrigger = FORMULA_TRIGGER_CHARS.some((prefix) =>
    value.startsWith(prefix),
  );
  return quoteCsvCell(isFormulaTrigger ? `'${value}` : value);
}

export async function GET(request: Request) {
  const parsedQuery = seasonQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(async () => {
      const [expenses, season] = await Promise.all([
        prisma.expense.findMany({
          where: { seasonId: parsedQuery.data.seasonId },
          orderBy: [{ date: "asc" }, { id: "asc" }],
          select: {
            date: true,
            description: true,
            amount: true,
            fencingCategory: true,
            category: { select: { name: true } },
            competition: { select: { name: true, location: true } },
            createdBy: { select: { name: true } },
          },
        }),
        prisma.season.findUnique({
          where: { id: parsedQuery.data.seasonId },
          select: { label: true },
        }),
      ]);

      return { expenses, season };
    });

    if (result instanceof NextResponse) {
      return result;
    }

    if (!result.season) {
      return NextResponse.json({ error: "Saison introuvable" }, { status: 404 });
    }

    const headerRow = [
      "Date",
      "Catégorie de dépense",
      "Catégorie de tireur",
      "Compétition",
      "Détail",
      "Montant",
      "Saisi par",
    ].map(csvTextCell);
    const dataRows = result.expenses.map((expense) => [
      csvTextCell(expense.date.toISOString().slice(0, 10)),
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
    const byteOrderMark = "﻿";
    const csv = `${byteOrderMark}${[headerRow, ...dataRows]
      .map((row) => row.join(";"))
      .join("\r\n")}\r\n`;
    const safeSeasonLabel = result.season.label.replace(
      /[^a-zA-Z0-9_-]+/g,
      "-",
    );

    return new NextResponse(csv, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="notes-de-frais-${safeSeasonLabel}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible d’exporter les notes de frais");
  }
}
