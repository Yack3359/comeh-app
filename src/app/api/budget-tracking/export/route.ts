import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { getBudgetTracking } from "@/lib/budget-tracking";
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

/** Texte saisi librement par les utilisateurs (ex. nom de catégorie) : neutralise l'injection de formule Excel. */
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
      const [tracking, season] = await Promise.all([
        getBudgetTracking(parsedQuery.data.seasonId),
        prisma.season.findUnique({
          where: { id: parsedQuery.data.seasonId },
          select: { label: true },
        }),
      ]);

      return { tracking, season };
    });

    if (result instanceof NextResponse) {
      return result;
    }

    if (!result.season) {
      return NextResponse.json({ error: "Saison introuvable" }, { status: 404 });
    }

    const headerRow = ["Catégorie", "Prévu", "Dépensé", "Reste", "%"].map(
      csvTextCell,
    );
    const dataRows = result.tracking.categories.map((category) => [
      csvTextCell(category.name),
      csvNumberCell(category.planned),
      csvNumberCell(category.spent),
      csvNumberCell(category.remaining),
      csvNumberCell(category.percentage),
    ]);
    const fiscalYearHeader = ["Année civile", "Dépensé"].map(csvTextCell);
    const fiscalYearRows = result.tracking.fiscalYears.map((fiscalYear) => [
      csvTextCell(fiscalYear.label),
      csvNumberCell(fiscalYear.spent),
    ]);
    const csv = `\uFEFF${[
      headerRow,
      ...dataRows,
      [],
      fiscalYearHeader,
      ...fiscalYearRows,
    ]
      .map((row) => row.join(";"))
      .join("\r\n")}\r\n`;
    const safeSeasonLabel = result.season.label.replace(
      /[^a-zA-Z0-9_-]+/g,
      "-",
    );

    return new NextResponse(csv, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="suivi-budget-${safeSeasonLabel}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible d’exporter le suivi budgétaire");
  }
}
