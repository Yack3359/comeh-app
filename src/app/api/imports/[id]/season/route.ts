import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  parseImportExtractionEnvelope,
  toImportJson,
} from "@/lib/import-batches";
import {
  importBatchParamsSchema,
  importSeasonUpdateSchema,
} from "@/lib/import-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

type RouteContext = {
  params: { id: string };
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext) {
  const parsedParams = importBatchParamsSchema.safeParse(context.params);
  const parsedBody = importSeasonUpdateSchema.safeParse(
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
            sourceType: true,
            status: true,
            rawExtractionJson: true,
            createdAt: true,
          },
        });

        if (!batch) {
          return {
            status: "error" as const,
            httpStatus: 404,
            message: "Import introuvable",
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
        if (envelope.validatedRowIndexes.length > 0) {
          return {
            status: "error" as const,
            httpStatus: 409,
            message:
              "Impossible de changer la saison : des lignes de cet import ont déjà été validées.",
          };
        }

        const season = await prisma.season.findUnique({
          where: { id: parsedBody.data.seasonId },
          select: { id: true },
        });
        if (!season) {
          return {
            status: "error" as const,
            httpStatus: 400,
            message: "La saison sélectionnée est invalide",
          };
        }

        const updated = await prisma.importBatch.update({
          where: { id: batch.id },
          data: {
            rawExtractionJson: toImportJson({
              ...envelope,
              seasonId: season.id,
            }),
          },
          select: {
            id: true,
            sourceType: true,
            status: true,
            rawExtractionJson: true,
            createdAt: true,
          },
        });

        return {
          status: "updated" as const,
          batch: {
            id: updated.id,
            sourceType: updated.sourceType,
            status: updated.status,
            extraction: updated.rawExtractionJson,
            createdAt: updated.createdAt,
            fileUrl: `/api/imports/${updated.id}/file`,
          },
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

    return NextResponse.json(result.batch);
  } catch (error) {
    return apiErrorResponse(
      error,
      "Impossible de changer la saison de cet import",
    );
  }
}
