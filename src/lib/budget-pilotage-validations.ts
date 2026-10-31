import { BudgetActionStatus, FencingCategory } from "@prisma/client";
import { z } from "zod";

const id = z.string().trim().min(1, "Identifiant requis").max(64);
export const pilotageParamsSchema = z.object({ id });
export const fiscalYearLabelSchema = z.string().regex(/^20\d{2}$/, "Exercice invalide");
export const pilotageQuerySchema = z.object({ fiscalYear: fiscalYearLabelSchema.optional() });
const matrixOverridesSchema = z.record(z.string().regex(/^[1-9]\d*$/, "Numéro de ligne invalide"), id.nullable());
export const previewFieldsSchema = z.object({
  fiscalYearLabel: fiscalYearLabelSchema.optional(), overrides: matrixOverridesSchema.optional(),
}).strict();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").refine(value => {
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Date invalide");
export const matrixApplySchema = z.object({
  fiscalYearLabel: fiscalYearLabelSchema, asOfDate: date,
  overrides: matrixOverridesSchema.optional(), historicalOnly: z.boolean().default(false),
}).strict();
const amount = z.number().finite().min(0).max(9_999_999_999.99).multipleOf(0.01, "Deux décimales au maximum");
const shared = {
  label: z.string().trim().min(1, "Libellé requis").max(1000),
  status: z.nativeEnum(BudgetActionStatus), settled: z.boolean().nullable(),
  revisedGross: amount, revisedClubIncome: amount, revisedFederation: amount,
  estimatedFederation: amount.nullable(), plannedMonth: z.number().int().min(1).max(12).nullable(),
  fencingCategories: z.array(z.nativeEnum(FencingCategory)).max(6).refine(values => new Set(values).size === values.length, "Catégories dupliquées"),
  notes: z.string().max(10000).nullable(), comment: z.string().max(10000).nullable(), competitionId: id.nullable(),
};
export const budgetActionCreateSchema = z.object({
  ...shared, postId: id, status: shared.status.default("UNBUDGETED"), settled: shared.settled.default(null),
  revisedGross: amount.default(0), revisedClubIncome: amount.default(0), revisedFederation: amount.default(0),
  estimatedFederation: shared.estimatedFederation.optional(), plannedMonth: shared.plannedMonth.optional(),
  fencingCategories: shared.fencingCategories.default([]), notes: shared.notes.optional(), comment: shared.comment.optional(), competitionId: shared.competitionId.optional(),
}).strict();
export const budgetActionUpdateSchema = z.object({
  adjustmentFederation: z.number().finite().min(-9_999_999_999.99).max(9_999_999_999.99).multipleOf(0.01, "Deux décimales au maximum"),
  adjustmentReason: z.string().trim().min(1, "Motif d’ajustement requis").max(2000),
  ...shared, includedInBudget: z.boolean(), revisionReason: z.string().trim().min(1, "Motif de révision requis").max(2000),
}).partial().strict().refine(value => Object.keys(value).length > 0, "Aucune modification");
export const restitutionUpdateSchema = z.object({ restitutionAmount: amount }).strict();
export const revisedAmountFields = ["revisedGross", "revisedClubIncome", "revisedFederation"] as const;
export function requiresRevisionReason(
  current: Record<typeof revisedAmountFields[number], number>,
  update: z.infer<typeof budgetActionUpdateSchema>,
): boolean {
  return revisedAmountFields.some(field => update[field] !== undefined && update[field] !== current[field]) && !update.revisionReason;
}

// Check the resulting amounts together, including a revision that reduces the ceiling.
export function validateAdjustment(
  current: { revisedFederation: number; adjustmentFederation: number },
  update: z.infer<typeof budgetActionUpdateSchema>,
): void {
  const adjustment = update.adjustmentFederation ?? current.adjustmentFederation;
  const revised = update.revisedFederation ?? current.revisedFederation;
  const issues: z.ZodIssue[] = [];
  if (adjustment < -revised) issues.push({ code: "custom", path: ["adjustmentFederation"],
    message: "La réduction ne peut pas dépasser le montant révisé FFE" });
  if (adjustment !== current.adjustmentFederation && !update.adjustmentReason) issues.push({
    code: "custom", path: ["adjustmentReason"], message: "Un motif est obligatoire lorsqu’un ajustement change",
  });
  if (issues.length) throw new z.ZodError(issues);
}

export function includedInBudgetForStatus(status: BudgetActionStatus, current: boolean): boolean {
  if (status === "CANCELLED") return current;
  return status !== "OPTION" && status !== "UNBUDGETED";
}
