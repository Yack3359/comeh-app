import { describe, expect, it, vi } from "vitest";
import { budgetActionCreateSchema, budgetActionUpdateSchema, matrixApplySchema, requiresRevisionReason, restitutionUpdateSchema, includedInBudgetForStatus, previewFieldsSchema } from "../budget-pilotage-validations";
import { matrixFileSchema, readMatrixUpload } from "../budget-matrix-upload";

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

describe("manual status and settlement validation", () => {
  it.each(["BUDGETED", "COMMITTED", "DONE", "OPTION", "UNBUDGETED", "CANCELLED"] as const)("synchronizes inclusion for %s", status => {
    for (const current of [false, true]) {
      expect(includedInBudgetForStatus(status, current)).toBe(status === "CANCELLED" ? current : ["BUDGETED", "COMMITTED", "DONE"].includes(status));
    }
  });
  it("accepts automatic and explicit settlement on create and update", () => {
    for (const settled of [null, false, true]) {
      expect(budgetActionCreateSchema.parse({ postId: "post", label: "Action", settled }).settled).toBe(settled);
      expect(budgetActionUpdateSchema.parse({ settled })).toEqual({ settled });
    }
    expect(budgetActionCreateSchema.parse({ postId: "post", label: "Action" }).settled).toBeNull();
    expect(budgetActionUpdateSchema.safeParse({ settled: "true" }).success).toBe(false);
  });
  it("validates preview overrides identically to apply and restricts historicalOnly to a boolean", () => {
    for (const overrides of [{ 8: null }, { 8: "action" }, { 0: null }, { 8: "" }, { 8: 123 }, []]) {
      expect(previewFieldsSchema.safeParse({ overrides }).success).toBe(matrixApplySchema.safeParse({ fiscalYearLabel: "2026", asOfDate: "2026-10-25", overrides }).success);
    }
    expect(matrixApplySchema.parse({ fiscalYearLabel: "2026", asOfDate: "2026-10-25" }).historicalOnly).toBe(false);
    expect(matrixApplySchema.parse({ fiscalYearLabel: "2026", asOfDate: "2026-10-25", historicalOnly: true }).historicalOnly).toBe(true);
    expect(matrixApplySchema.safeParse({ fiscalYearLabel: "2026", asOfDate: "2026-10-25", historicalOnly: "true" }).success).toBe(false);
  });
});
describe("upload request size", () => {
  it("rejects more than 6 MiB before reading multipart data", async () => {
    const request = new Request("http://localhost/preview", { method: "POST", headers: { "content-length": String(6 * 1024 * 1024 + 1) } });
    const formData = vi.spyOn(request, "formData");
    await expect(readMatrixUpload(request)).rejects.toMatchObject({ status: 413 });
    expect(formData).not.toHaveBeenCalled();
  });
  it.each([null, String(6 * 1024 * 1024)])("reads multipart data at an allowed or missing length (%s)", async length => {
    const request = new Request("http://localhost/preview", { method: "POST", headers: length ? { "content-length": length } : {} });
    const formData = vi.spyOn(request, "formData").mockResolvedValue(new FormData());
    await expect(readMatrixUpload(request)).rejects.toMatchObject({ status: 400 });
    expect(formData).toHaveBeenCalledOnce();
  });
});
