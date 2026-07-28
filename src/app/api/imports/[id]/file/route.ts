import { readFile } from "node:fs/promises";

import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { parseImportExtractionEnvelope } from "@/lib/import-batches";
import { resolveStoredUpload } from "@/lib/import-storage";
import { importBatchParamsSchema } from "@/lib/import-validations";
import { prisma } from "@/lib/prisma";

const allowedRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

type RouteContext = {
  params: { id: string };
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function contentDisposition(fileName: string) {
  const asciiName =
    fileName
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\]/g, "_")
      .slice(0, 180) || "document";

  return `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(_request: Request, context: RouteContext) {
  const parsedParams = importBatchParamsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
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
            fileUrl: true,
            rawExtractionJson: true,
          },
        });

        if (!batch) {
          return { status: "not_found" as const };
        }

        const parsedEnvelope = parseImportExtractionEnvelope(
          batch.rawExtractionJson,
        );
        if (!parsedEnvelope.success) {
          return { status: "invalid_metadata" as const };
        }

        const bytes = await readFile(resolveStoredUpload(batch.fileUrl));
        return {
          status: "found" as const,
          bytes,
          mimeType: parsedEnvelope.data.mimeType,
          originalName: parsedEnvelope.data.originalName,
        };
      },
      allowedRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status === "not_found") {
      return NextResponse.json(
        { error: "Import introuvable ou accès interdit" },
        { status: 404 },
      );
    }

    if (result.status === "invalid_metadata") {
      return NextResponse.json(
        { error: "Les métadonnées du fichier sont invalides" },
        { status: 500 },
      );
    }

    return new NextResponse(new Uint8Array(result.bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(result.originalName),
        "Content-Type": result.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return NextResponse.json(
        { error: "Le fichier original est introuvable" },
        { status: 404 },
      );
    }

    return apiErrorResponse(
      error,
      "Impossible de télécharger le fichier original",
    );
  }
}

