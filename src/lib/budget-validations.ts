import { FencingCategory } from "@prisma/client";
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
          fencingCategory: z.nativeEnum(FencingCategory),
          plannedAmount: amountSchema,
        }),
      )
      .max(1600),
  })
  .superRefine(({ budgets }, context) => {
    const budgetKeys = new Set<string>();

    budgets.forEach(({ categoryId, fencingCategory }, index) => {
      const key = `${categoryId}:${fencingCategory}`;
      if (budgetKeys.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Une catégorie de dépense ne peut apparaître qu’une fois par catégorie de tireur",
          path: ["budgets", index, "categoryId"],
        });
      }
      budgetKeys.add(key);
    });
  });

export const expenseCreateSchema = z.object({
  seasonId: idSchema,
  categoryId: idSchema,
  fencingCategory: z.nativeEnum(FencingCategory).nullable().optional().default(null),
  competitionId: idSchema.nullable().optional().default(null),
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
});

export const expenseQuerySchema = z.object({
  seasonId: idSchema.optional(),
  categoryId: idSchema.optional(),
  fencingCategory: z
    .union([z.nativeEnum(FencingCategory), z.literal("NONE")])
    .optional(),
  competitionId: idSchema.optional(),
});
