import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Date invalide");

export const auditQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    userId: z.string().trim().min(1).max(64).optional(),
    entityType: z.string().trim().min(1).max(100).optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .superRefine(({ from, to }, context) => {
    if (from && to && from > to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La date de début doit précéder la date de fin",
        path: ["from"],
      });
    }
  });
