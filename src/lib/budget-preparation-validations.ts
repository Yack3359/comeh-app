import { BudgetProposalStatus, FencingCategory } from "@prisma/client";
import { z } from "zod";
import { fiscalYearLabelSchema } from "./budget-pilotage-validations";

const id = z.string().trim().min(1, "Identifiant requis").max(64);
export const preparationAmount = z.number().finite().min(0).max(9_999_999_999.99).multipleOf(0.01, "Deux décimales au maximum");
export const preparationDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").refine(value => {
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Date invalide");
const count = z.number().int().min(0).max(999).nullable();
const fields = {
  postId: id, label: z.string().trim().min(1, "Libellé requis").max(1000),
  plannedMonth: z.number().int().min(1).max(12).nullable(),
  fencingCategories: z.array(z.nativeEnum(FencingCategory)).max(6).refine(values => new Set(values).size === values.length, "Catégories dupliquées"),
  athleteCount: count, staffCount: count, dayCount: count,
  revisedGross: preparationAmount, revisedFederation: preparationAmount,
  amountsConfirmed: z.boolean(), proposalStatus: z.nativeEnum(BudgetProposalStatus), comment: z.string().max(10000).nullable(),
};
export function validatePreparationAmounts(amounts: { revisedGross: number; revisedFederation: number }) {
  if (amounts.revisedFederation > amounts.revisedGross) throw new z.ZodError([{ code: "custom", path: ["revisedFederation"], message: "La part FFE ne peut pas dépasser le coût total" }]);
}
export const preparationCreateSchema = z.object({ ...fields, plannedMonth: fields.plannedMonth.default(null),
  fencingCategories: fields.fencingCategories.default([]), athleteCount: count.default(null), staffCount: count.default(null), dayCount: count.default(null),
  revisedGross: preparationAmount.default(0), revisedFederation: preparationAmount.default(0), amountsConfirmed: z.boolean().default(false),
  proposalStatus: fields.proposalStatus.default("PROPOSED"), comment: fields.comment.default(null),
}).strict().refine(value => value.revisedFederation <= value.revisedGross, { path: ["revisedFederation"], message: "La part FFE ne peut pas dépasser le coût total" });
export const preparationUpdateSchema = z.object(fields).partial().strict().refine(value => Object.keys(value).length > 0, "Aucune modification");
export const preparationOpenSchema = z.object({ fiscalYearLabel: fiscalYearLabelSchema, copyFromPrevious: z.boolean() }).strict();
export const preparationVoteSchema = z.object({ fiscalYearLabel: fiscalYearLabelSchema, keepPending: z.boolean() }).strict();
export const preparationReopenSchema = z.object({ fiscalYearLabel: fiscalYearLabelSchema }).strict();
export const fiscalYearUpdateSchema = z.object({ restitutionAmount: preparationAmount.optional(), targetFederation: preparationAmount.nullable().optional(),
  preparationDeadline: preparationDate.nullable().optional(),
}).strict().refine(value => Object.keys(value).length > 0, "Aucune modification");
