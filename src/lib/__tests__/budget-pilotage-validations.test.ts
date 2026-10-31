import { describe, expect, it } from "vitest";
import { budgetActionCreateSchema, budgetActionUpdateSchema, matrixApplySchema, requiresRevisionReason, restitutionUpdateSchema } from "../budget-pilotage-validations";
import { matrixFileSchema } from "../budget-matrix-upload";

describe("pilotage API validation", () => {
  it("defaults manual actions to UNBUDGETED and rejects protected/unknown fields", () => {
    expect(budgetActionCreateSchema.parse({ postId: "post", label: "Action" })).toMatchObject({ status: "UNBUDGETED", revisedFederation: 0, fencingCategories: [] });
    for (const field of ["initialFederation", "actualFederation", "seasonId", "postId"]) {
      expect(budgetActionUpdateSchema.safeParse({ [field]: 50 }).success).toBe(false);
    }
  });
  it("accepts nullable commission comments up to 10000 characters on create and update", () => {
    for (const comment of [null, "", "Décision de la commission", "x".repeat(10000)]) {
      expect(budgetActionCreateSchema.parse({ postId: "post", label: "Action", comment }).comment).toBe(comment);
      expect(budgetActionUpdateSchema.parse({ comment })).toEqual({ comment });
    }
    for (const comment of [42, "x".repeat(10001)]) {
      expect(budgetActionCreateSchema.safeParse({ postId: "post", label: "Action", comment }).success).toBe(false);
      expect(budgetActionUpdateSchema.safeParse({ comment }).success).toBe(false);
    }
  });
  it("requires a revision reason only when a revised amount really changes", () => {
    const current = { revisedGross: 100, revisedClubIncome: 10, revisedFederation: 90 };
    expect(requiresRevisionReason(current, { revisedFederation: 90 })).toBe(false);
    expect(requiresRevisionReason(current, { revisedFederation: 91 })).toBe(true);
    expect(requiresRevisionReason(current, { revisedFederation: 91, revisionReason: "Nouveau devis" })).toBe(false);
  });
  it("validates real dates, overrides, month, finite amounts, categories and nullable patches", () => {
    expect(matrixApplySchema.safeParse({ fiscalYearLabel: "2026", asOfDate: "2026-02-31" }).success).toBe(false);
    expect(matrixApplySchema.safeParse({ fiscalYearLabel: "2026", asOfDate: "2026-09-08", overrides: { 0: null } }).success).toBe(false);
    expect(matrixApplySchema.parse({ fiscalYearLabel: "2026", asOfDate: "2026-09-08", overrides: { 8: null } }).overrides).toEqual({ 8: null });
    for (const payload of [{ plannedMonth: 0 }, { plannedMonth: 13 }, { revisedGross: Infinity }, { revisedGross: 1.111 }, { fencingCategories: ["M20", "M20"] }, {}]) {
      expect(budgetActionUpdateSchema.safeParse(payload).success).toBe(false);
    }
    expect(budgetActionUpdateSchema.parse({ estimatedFederation: null, plannedMonth: null, competitionId: null })).toEqual({ estimatedFederation: null, plannedMonth: null, competitionId: null });
    expect(restitutionUpdateSchema.safeParse({ restitutionAmount: -1 }).success).toBe(false);
  });
  it("accepts only nonempty xlsx files up to 5 MiB", () => {
    const file = (name: string, size: number) => ({ name, size, arrayBuffer: async () => new ArrayBuffer(0) });
    expect(matrixFileSchema.safeParse(file("matrice.XLSX", 5 * 1024 * 1024)).success).toBe(true);
    for (const input of [null, "file", file("matrice.xls", 100), file("matrice.xlsx", 0), file("matrice.xlsx", 5 * 1024 * 1024 + 1)]) {
      expect(matrixFileSchema.safeParse(input).success).toBe(false);
    }
  });
});
