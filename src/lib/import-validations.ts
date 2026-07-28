import { z } from "zod";

import { expenseCreateSchema } from "@/lib/budget-validations";
import { resultCreateSchema } from "@/lib/rankings-validations";

export const importTargetSchema = z.enum(["expense", "result"]);

export const importUploadFieldsSchema = z.object({
  target: importTargetSchema,
  seasonId: z.string().trim().min(1, "La saison est requise").max(64),
});

const importedRowSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    index: z.number().int().nonnegative(),
    data: dataSchema,
  });

export const importValidationSchema = z
  .discriminatedUnion("target", [
    z.object({
      target: z.literal("expense"),
      rows: z
        .array(importedRowSchema(expenseCreateSchema))
        .min(1, "Sélectionnez au moins une ligne")
        .max(500),
    }),
    z.object({
      target: z.literal("result"),
      rows: z
        .array(importedRowSchema(resultCreateSchema))
        .min(1, "Sélectionnez au moins une ligne")
        .max(500),
    }),
  ])
  .superRefine(({ rows }, context) => {
    const indexes = new Set<number>();

    rows.forEach(({ index }, rowIndex) => {
      if (indexes.has(index)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Une ligne ne peut être validée qu’une fois",
          path: ["rows", rowIndex, "index"],
        });
      }
      indexes.add(index);
    });
  });

export const importBatchParamsSchema = z.object({
  id: z.string().trim().min(1, "Identifiant requis").max(64),
});

