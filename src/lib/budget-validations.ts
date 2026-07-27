import { ExpenseType } from "@prisma/client";
import { z } from "zod";

const idSchema = z.string().trim().min(1, "Identifiant requis").max(64);

export const seasonQuerySchema = z.object({
  seasonId: idSchema,
});

export const budgetCategoryCreateSchema = z.object({
  seasonId: idSchema,
  name: z.string().trim().min(2, "Le nom est trop court").max(80),
});

export const budgetCategoryUpdateSchema = budgetCategoryCreateSchema.pick({
  name: true,
});

const amountSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim().replace(",", "."))
  .refine(
    (value) => /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value),
    "Montant invalide (deux décimales maximum)",
  );

export const budgetUpdateSchema = z
  .object({
    seasonId: idSchema,
    budgets: z
      .array(
        z.object({
          categoryId: idSchema,
          plannedAmount: amountSchema,
        }),
      )
      .max(200),
  })
  .superRefine(({ budgets }, context) => {
    const categoryIds = new Set<string>();

    budgets.forEach(({ categoryId }, index) => {
      if (categoryIds.has(categoryId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Une catégorie ne peut apparaître qu’une fois",
          path: ["budgets", index, "categoryId"],
        });
      }
      categoryIds.add(categoryId);
    });
  });

export const expenseCreateSchema = z.object({
  seasonId: idSchema,
  categoryId: idSchema,
  type: z.nativeEnum(ExpenseType),
  amount: amountSchema.refine((value) => Number(value) > 0, "Le montant doit être positif"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
    .refine((value) => {
      const parsedDate = new Date(`${value}T00:00:00.000Z`);
      return (
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === value
      );
    }, "Date invalide"),
  description: z.string().trim().min(2, "La description est trop courte").max(500),
  relatedEvent: z.string().trim().max(160).optional().default(""),
});

export const expenseQuerySchema = z.object({
  seasonId: idSchema.optional(),
  categoryId: idSchema.optional(),
  type: z.nativeEnum(ExpenseType).optional(),
});
