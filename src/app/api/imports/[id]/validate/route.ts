import {
  ExpenseSource,
  ImportStatus,
  Role,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  parseImportExtractionEnvelope,
  toImportJson,
} from "@/lib/import-batches";
import {
  importBatchParamsSchema,
  importValidationSchema,
} from "@/lib/import-validations";
import {
  resultRelationError,
  toResultData,
  validateResultRelations,
} from "@/lib/ranking-results";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

type RouteContext = {
  params: { id: string };
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext) {
  const parsedParams = importBatchParamsSchema.safeParse(context.params);
  const parsedBody = importValidationSchema.safeParse(
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
      async (userId) => {
        const batch = await prisma.importBatch.findFirst({
          where: {
            id: parsedParams.data.id,
            userId,
          },
          select: {
            id: true,
            fileUrl: true,
            status: true,
            rawExtractionJson: true,
          },
        });

        if (!batch) {
          return {
            status: "error" as const,
            httpStatus: 404,
            message: "Import introuvable",
          };
        }

        if (batch.status !== ImportStatus.EXTRACTED) {
          return {
            status: "error" as const,
            httpStatus: 409,
            message:
              batch.status === ImportStatus.VALIDATED
                ? "Cet import est déjà entièrement validé"
                : "Cet import n’est pas prêt à être validé",
          };
        }

        const parsedEnvelope = parseImportExtractionEnvelope(
          batch.rawExtractionJson,
        );
        if (!parsedEnvelope.success) {
          return {
            status: "error" as const,
            httpStatus: 500,
            message: "Les données extraites de cet import sont invalides",
          };
        }

        const envelope = parsedEnvelope.data;
        if (envelope.target !== parsedBody.data.target) {
          return {
            status: "error" as const,
            httpStatus: 400,
            message: "Le type de validation ne correspond pas à cet import",
          };
        }

        const validatedIndexes = new Set(envelope.validatedRowIndexes);
        for (const row of parsedBody.data.rows) {
          if (row.index >= envelope.rows.length) {
            return {
              status: "error" as const,
              httpStatus: 400,
              message: `La ligne ${row.index + 1} n’existe pas`,
            };
          }
          if (validatedIndexes.has(row.index)) {
            return {
              status: "error" as const,
              httpStatus: 409,
              message: `La ligne ${row.index + 1} est déjà validée`,
            };
          }
        }

        if (parsedBody.data.target === "expense") {
          const season = await prisma.season.findUnique({
            where: { id: envelope.seasonId },
            select: {
              id: true,
              startDate: true,
              endDate: true,
            },
          });
          if (!season) {
            return {
              status: "error" as const,
              httpStatus: 400,
              message: "La saison de l’import n’existe plus",
            };
          }

          const categoryIds = [
            ...new Set(parsedBody.data.rows.map(({ data }) => data.categoryId)),
          ];
          const categories = await prisma.budgetCategory.findMany({
            where: {
              id: { in: categoryIds },
              seasonId: season.id,
            },
            select: { id: true },
          });
          const validCategoryIds = new Set(
            categories.map((category) => category.id),
          );

          const competitionIds = [
            ...new Set(
              parsedBody.data.rows
                .map(({ data }) => data.competitionId)
                .filter((competitionId): competitionId is string =>
                  Boolean(competitionId),
                ),
            ),
          ];
          const validCompetitionIds = new Set(
            competitionIds.length > 0
              ? (
                  await prisma.competition.findMany({
                    where: { id: { in: competitionIds }, seasonId: season.id },
                    select: { id: true },
                  })
                ).map((competition) => competition.id)
              : [],
          );

          for (const row of parsedBody.data.rows) {
            if (row.data.seasonId !== season.id) {
              return {
                status: "error" as const,
                httpStatus: 400,
                message: `La saison de la ligne ${row.index + 1} est invalide`,
              };
            }
            if (!validCategoryIds.has(row.data.categoryId)) {
              return {
                status: "error" as const,
                httpStatus: 400,
                message: `La catégorie de la ligne ${row.index + 1} est invalide`,
              };
            }
            if (
              row.data.competitionId &&
              !validCompetitionIds.has(row.data.competitionId)
            ) {
              return {
                status: "error" as const,
                httpStatus: 400,
                message: `La compétition de la ligne ${row.index + 1} est invalide`,
              };
            }

            const expenseDate = new Date(
              `${row.data.date}T00:00:00.000Z`,
            );
            if (
              expenseDate < season.startDate ||
              expenseDate > season.endDate
            ) {
              return {
                status: "error" as const,
                httpStatus: 400,
                message: `La date de la ligne ${row.index + 1} doit être comprise dans la saison`,
              };
            }
          }
        } else {
          const competitionIds = [
            ...new Set(
              parsedBody.data.rows.map(({ data }) => data.competitionId),
            ),
          ];
          const competitions = await prisma.competition.findMany({
            where: { id: { in: competitionIds } },
            select: { id: true, seasonId: true },
          });
          const competitionsById = new Map(
            competitions.map((competition) => [
              competition.id,
              competition.seasonId,
            ]),
          );

          for (const row of parsedBody.data.rows) {
            if (
              competitionsById.get(row.data.competitionId) !==
              envelope.seasonId
            ) {
              return {
                status: "error" as const,
                httpStatus: 400,
                message: `La compétition de la ligne ${row.index + 1} n’appartient pas à la saison de l’import`,
              };
            }

            const relationStatus = await validateResultRelations(row.data);
            if (relationStatus !== "valid") {
              return {
                status: "error" as const,
                httpStatus: 400,
                message: `Ligne ${row.index + 1} : ${
                  resultRelationError(relationStatus) ?? "relations invalides"
                }`,
              };
            }
          }
        }

        const claimed = await prisma.importBatch.updateMany({
          where: {
            id: batch.id,
            userId,
            status: ImportStatus.EXTRACTED,
          },
          data: { status: ImportStatus.PENDING },
        });
        if (claimed.count !== 1) {
          return {
            status: "error" as const,
            httpStatus: 409,
            message: "Cet import est déjà en cours de validation",
          };
        }

        const createdEntityIds = {
          ...(envelope.createdEntityIds ?? {}),
        };
        parsedBody.data.rows.forEach(({ index }) => validatedIndexes.add(index));
        const finalStatus =
          validatedIndexes.size === envelope.rows.length
            ? ImportStatus.VALIDATED
            : ImportStatus.EXTRACTED;

        try {
          await prisma.$transaction(async (transaction) => {
            if (parsedBody.data.target === "expense") {
              for (const row of parsedBody.data.rows) {
                const created = await transaction.expense.create({
                  data: {
                    seasonId: row.data.seasonId,
                    categoryId: row.data.categoryId,
                    fencingCategory: row.data.fencingCategory,
                    competitionId: row.data.competitionId,
                    amount: row.data.amount,
                    date: new Date(`${row.data.date}T00:00:00.000Z`),
                    description: row.data.description,
                    createdById: userId,
                    source: ExpenseSource.IMPORT,
                    attachmentUrl: batch.fileUrl,
                  },
                  select: { id: true },
                });
                createdEntityIds[String(row.index)] = created.id;
              }
            } else {
              for (const row of parsedBody.data.rows) {
                const created = await transaction.result.create({
                  data: toResultData(row.data),
                  select: { id: true },
                });
                createdEntityIds[String(row.index)] = created.id;
              }
            }

            await transaction.importBatch.update({
              where: { id: batch.id },
              data: {
                status: finalStatus,
                rawExtractionJson: toImportJson({
                  ...envelope,
                  validatedRowIndexes: [...validatedIndexes].sort(
                    (left, right) => left - right,
                  ),
                  createdEntityIds,
                }),
              },
            });
          });
        } catch (error) {
          await prisma.importBatch.updateMany({
            where: {
              id: batch.id,
              userId,
              status: ImportStatus.PENDING,
            },
            data: { status: ImportStatus.EXTRACTED },
          });
          throw error;
        }

        return {
          status: "validated" as const,
          batchStatus: finalStatus,
          validatedRowIndexes: [...validatedIndexes].sort(
            (left, right) => left - right,
          ),
        };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status === "error") {
      return NextResponse.json(
        { error: result.message },
        { status: result.httpStatus },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Impossible de valider cet import");
  }
}

