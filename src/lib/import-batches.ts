import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { importTargetSchema } from "@/lib/import-validations";

export const importExtractionEnvelopeSchema = z.object({
  version: z.literal(1),
  target: importTargetSchema,
  seasonId: z.string().trim().min(1).max(64),
  mimeType: z.string().trim().min(1).max(160),
  originalName: z.string().trim().min(1).max(180),
  rows: z.array(z.unknown()).max(500).default([]),
  validatedRowIndexes: z.array(z.number().int().nonnegative()).default([]),
  createdEntityIds: z.record(z.string()).optional(),
  error: z.string().max(500).optional(),
});

export type ImportExtractionEnvelope = z.infer<
  typeof importExtractionEnvelopeSchema
>;

export function parseImportExtractionEnvelope(value: unknown) {
  return importExtractionEnvelopeSchema.safeParse(value);
}

export function toImportJson(
  envelope: ImportExtractionEnvelope,
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(envelope)) as Prisma.InputJsonValue;
}

export function safeOriginalName(fileName: string, fallback: string) {
  const normalized = fileName
    .replace(/[/\\]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180);

  return normalized || fallback;
}

