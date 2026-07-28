import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ImportSourceType,
  ImportStatus,
  Role,
} from "@prisma/client";
import { NextResponse } from "next/server";

import {
  extractExpenseFromDocument,
  extractResultsFromDocument,
  type SupportedDocumentMediaType,
} from "@/lib/ai-extraction";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  safeOriginalName,
  toImportJson,
  type ImportExtractionEnvelope,
} from "@/lib/import-batches";
import { getUploadRoot, storedUploadPath } from "@/lib/import-storage";
import { importUploadFieldsSchema } from "@/lib/import-validations";
import { parseExpensesExcel, parseResultsExcel } from "@/lib/excel-import";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
const MEBIBYTE = 1024 * 1024;
const EXTRACTION_TIMEOUT_MS = 75_000;

type MimeConfiguration = {
  extension: string;
  maxSize: number;
  sourceType: ImportSourceType;
  documentMediaType?: SupportedDocumentMediaType;
};

const mimeConfigurations: Record<string, MimeConfiguration> = {
  "application/pdf": {
    extension: ".pdf",
    maxSize: 15 * MEBIBYTE,
    sourceType: ImportSourceType.PDF,
    documentMediaType: "application/pdf",
  },
  "image/jpeg": {
    extension: ".jpg",
    maxSize: 15 * MEBIBYTE,
    sourceType: ImportSourceType.IMAGE,
    documentMediaType: "image/jpeg",
  },
  "image/png": {
    extension: ".png",
    maxSize: 15 * MEBIBYTE,
    sourceType: ImportSourceType.IMAGE,
    documentMediaType: "image/png",
  },
  "image/gif": {
    extension: ".gif",
    maxSize: 15 * MEBIBYTE,
    sourceType: ImportSourceType.IMAGE,
    documentMediaType: "image/gif",
  },
  "image/webp": {
    extension: ".webp",
    maxSize: 15 * MEBIBYTE,
    sourceType: ImportSourceType.IMAGE,
    documentMediaType: "image/webp",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extension: ".xlsx",
    maxSize: 5 * MEBIBYTE,
    sourceType: ImportSourceType.EXCEL,
  },
  "application/vnd.ms-excel": {
    extension: ".xls",
    maxSize: 5 * MEBIBYTE,
    sourceType: ImportSourceType.EXCEL,
  },
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function batchResponse(
  batch: {
    id: string;
    sourceType: ImportSourceType;
    status: ImportStatus;
    rawExtractionJson: unknown;
    createdAt: Date;
  },
  message?: string,
) {
  return {
    id: batch.id,
    sourceType: batch.sourceType,
    status: batch.status,
    extraction: batch.rawExtractionJson,
    createdAt: batch.createdAt,
    fileUrl: `/api/imports/${batch.id}/file`,
    message,
  };
}

async function withExtractionTimeout<T>(operation: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("L’extraction a dépassé le délai de 75 secondes")),
      EXTRACTION_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function extractionErrorMessage(error: unknown, isDocument: boolean) {
  if (
    isDocument &&
    error instanceof Error &&
    error.message.includes("ANTHROPIC_API_KEY")
  ) {
    return "Extraction IA indisponible : ANTHROPIC_API_KEY non configurée";
  }

  if (error instanceof Error && error.message.includes("délai de 75 secondes")) {
    return error.message;
  }

  if (
    error instanceof Error &&
    (error.message.includes("Aucune ligne exploitable") ||
      error.message.includes("plus de 500 lignes"))
  ) {
    return error.message;
  }

  return isDocument
    ? "L’extraction IA a échoué. Vous pouvez conserver cet import et réessayer avec un autre document."
    : "La lecture du fichier Excel a échoué. Vérifiez son format et ses colonnes.";
}

export async function GET() {
  try {
    const result = await runAsAuthenticatedUser(
      async (userId) => {
        const batches = await prisma.importBatch.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            sourceType: true,
            status: true,
            rawExtractionJson: true,
            createdAt: true,
          },
        });

        return batches.map((batch) => batchResponse(batch));
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de charger les imports");
  }
}

export async function POST(request: Request) {
  try {
    const result = await runAsAuthenticatedUser(
      async (userId) => {
        const formData = await request.formData().catch(() => null);
        if (!formData) {
          return NextResponse.json(
            { error: "Le formulaire d’upload est invalide" },
            { status: 400 },
          );
        }

        const parsedFields = importUploadFieldsSchema.safeParse({
          target: formData.get("target"),
          seasonId: formData.get("seasonId"),
        });
        if (!parsedFields.success) {
          return invalidDataResponse(parsedFields.error);
        }

        const file = formData.get("file");
        if (!(file instanceof File)) {
          return NextResponse.json(
            { error: "Sélectionnez un fichier à importer" },
            { status: 400 },
          );
        }

        const configuration = mimeConfigurations[file.type];
        if (!configuration) {
          return NextResponse.json(
            {
              error:
                "Type de fichier refusé. Formats acceptés : PDF, JPEG, PNG, GIF, WebP, XLSX et XLS.",
            },
            { status: 415 },
          );
        }

        if (file.size === 0) {
          return NextResponse.json(
            { error: "Le fichier sélectionné est vide" },
            { status: 400 },
          );
        }

        if (file.size > configuration.maxSize) {
          const maximum =
            configuration.sourceType === ImportSourceType.EXCEL
              ? "5 Mo"
              : "15 Mo";
          return NextResponse.json(
            { error: `Fichier trop volumineux : la limite est de ${maximum}.` },
            { status: 413 },
          );
        }

        const season = await prisma.season.findUnique({
          where: { id: parsedFields.data.seasonId },
          select: { id: true },
        });
        if (!season) {
          return NextResponse.json(
            { error: "La saison sélectionnée est invalide" },
            { status: 400 },
          );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const generatedFileName = `${randomUUID()}${configuration.extension}`;
        const fileUrl = storedUploadPath(generatedFileName);
        await mkdir(getUploadRoot(), { recursive: true });
        await writeFile(path.join(getUploadRoot(), generatedFileName), buffer, {
          flag: "wx",
        });

        const initialEnvelope: ImportExtractionEnvelope = {
          version: 1,
          target: parsedFields.data.target,
          seasonId: season.id,
          mimeType: file.type,
          originalName: safeOriginalName(
            file.name,
            `document${configuration.extension}`,
          ),
          rows: [],
          validatedRowIndexes: [],
        };

        const batch = await prisma.importBatch.create({
          data: {
            userId,
            sourceType: configuration.sourceType,
            fileUrl,
            status: ImportStatus.PENDING,
            rawExtractionJson: toImportJson(initialEnvelope),
          },
          select: {
            id: true,
            sourceType: true,
            status: true,
            rawExtractionJson: true,
            createdAt: true,
          },
        });

        try {
          let rows: unknown[];

          if (configuration.documentMediaType) {
            const base64Data = buffer.toString("base64");
            if (parsedFields.data.target === "expense") {
              rows = [
                await withExtractionTimeout(
                  extractExpenseFromDocument(
                    base64Data,
                    configuration.documentMediaType,
                  ),
                ),
              ];
            } else {
              rows = await withExtractionTimeout(
                extractResultsFromDocument(
                  base64Data,
                  configuration.documentMediaType,
                ),
              );
            }
          } else if (parsedFields.data.target === "expense") {
            rows = parseExpensesExcel(buffer);
          } else {
            rows = parseResultsExcel(buffer);
          }

          if (rows.length === 0) {
            throw new Error("Aucune ligne exploitable n’a été trouvée");
          }
          if (rows.length > 500) {
            throw new Error(
              "Le fichier contient plus de 500 lignes exploitables. Découpez-le en plusieurs imports.",
            );
          }

          const extractedEnvelope: ImportExtractionEnvelope = {
            ...initialEnvelope,
            rows,
          };
          const extracted = await prisma.importBatch.update({
            where: { id: batch.id },
            data: {
              status: ImportStatus.EXTRACTED,
              rawExtractionJson: toImportJson(extractedEnvelope),
            },
            select: {
              id: true,
              sourceType: true,
              status: true,
              rawExtractionJson: true,
              createdAt: true,
            },
          });

          return NextResponse.json(batchResponse(extracted), { status: 201 });
        } catch (error) {
          const message = extractionErrorMessage(
            error,
            Boolean(configuration.documentMediaType),
          );
          const failedEnvelope: ImportExtractionEnvelope = {
            ...initialEnvelope,
            error: message,
          };
          const failed = await prisma.importBatch.update({
            where: { id: batch.id },
            data: {
              status: ImportStatus.FAILED,
              rawExtractionJson: toImportJson(failedEnvelope),
            },
            select: {
              id: true,
              sourceType: true,
              status: true,
              rawExtractionJson: true,
              createdAt: true,
            },
          });

          return NextResponse.json(batchResponse(failed, message), {
            status: 201,
          });
        }
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Impossible d’importer ce fichier");
  }
}
