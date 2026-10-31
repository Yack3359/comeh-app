import type { BudgetActionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildMonthlyReportText, computeActionFigures, computeFiscalYearSummary, computePostSummary, listVigilancePoints } from "../budget-pilotage";
import { pilotageAction, post } from "./budget-fixtures";

describe("action figures", () => {
  it.each([
    ["CANCELLED", null, null, 0], ["CANCELLED", 20, 90, 20],
    ["DONE", null, null, 100], ["DONE", 0, null, 0], ["DONE", 20, 90, 20],
    ["OPTION", 20, 90, 0],
    ["BUDGETED", null, null, 100], ["BUDGETED", 120, 90, 120], ["BUDGETED", 20, 90, 90],
    ["COMMITTED", null, null, 100], ["COMMITTED", 120, 90, 120],
    ["UNBUDGETED", null, null, 0], ["UNBUDGETED", 20, null, 20], ["UNBUDGETED", 20, 90, 90],
  ] as const)("computes landing for %s / actual %s / estimated %s", (status: BudgetActionStatus, actualFederation: number | null, estimatedFederation: number | null, landing: number) => {
    expect(computeActionFigures(pilotageAction({ status, actualFederation, estimatedFederation })).landing).toBe(landing);
  });
  it("excludes options, unbudgeted and unincluded rows from the budget, with positive overspend", () => {
    for (const patch of [{ status: "OPTION" as const }, { status: "UNBUDGETED" as const }, { includedInBudget: false }]) {
      expect(computeActionFigures(pilotageAction({ ...patch, actualFederation: 20 }))).toMatchObject({ budget: 0, actual: 20, variance: 20, remaining: -20 });
    }
    expect(computeActionFigures(pilotageAction({ actualFederation: 110 }))).toMatchObject({ variance: 10, remaining: -10 });
  });
});
describe("summaries and vigilance", () => {
  it.each([
    [100.5, 100.5, "green"], [100.51, 100.51, "red"], [50, 100.51, "orange"], [50, 100.5, "green"],
  ] as const)("uses rounding tolerance with actual %s and landing %s", (actualFederation: number, estimatedFederation: number, flag: string) => {
    expect(computePostSummary(post, [pilotageAction({ actualFederation, estimatedFederation })]).flag).toBe(flag);
  });
  it("aggregates only the selected post, tracks options/savings/statuses and deducts restitution", () => {
    const actions = [
      pilotageAction({ status: "CANCELLED", actualFederation: 20, proposedSaving: true }),
      pilotageAction({ id: "option", status: "OPTION", includedInBudget: false, revisedFederation: 40 }),
      pilotageAction({ id: "outside", status: "UNBUDGETED", includedInBudget: false, estimatedFederation: 30 }),
      pilotageAction({ id: "saving", proposedSaving: true, revisedFederation: 60, estimatedFederation: 0 }),
    ];
    const summary = computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: 10 }, posts: [post], actions });
    expect(summary.totals).toMatchObject({ budget: 160, initialBudget: 160, actual: 20, landing: 50, margin: 110, remaining: 140, options: 40, unbudgeted: 30, proposedSavings: 60, gross: { budget: 300 }, clubIncome: { budget: 100 } });
    expect(summary.globalMargin).toBe(100);
    expect(summary.totals.counts).toMatchObject({ CANCELLED: 1, OPTION: 1, UNBUDGETED: 1, BUDGETED: 1, COMMITTED: 0, DONE: 0 });
    expect(computePostSummary({ ...post, id: "other" }, actions).budget).toBe(0);
    expect(computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: 200 }, posts: [post], actions }).flag).toBe("orange");
  });
  it("lists all requested vigilance situations with French formatted amounts", () => {
    const actions = [
      pilotageAction({ id: "over", actualFederation: 12445 }),
      pilotageAction({ id: "outside", status: "UNBUDGETED", includedInBudget: false, estimatedFederation: 50 }),
      pilotageAction({ id: "saving", proposedSaving: true }),
      pilotageAction({ id: "option", status: "OPTION", includedInBudget: false }),
    ].map(action => ({ ...action, postCode: "B" }));
    const summary = computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: 0 }, posts: [post], actions });
    const points = listVigilancePoints(summary, actions);
    expect(points).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: "red", message: expect.stringContaining("12 345 €") }),
      expect.objectContaining({ level: "orange", message: expect.stringContaining("atterrissage supérieur") }),
      expect.objectContaining({ message: expect.stringContaining("hors budget") }),
      expect.objectContaining({ message: expect.stringContaining("économie proposée à valider") }),
      expect.objectContaining({ message: expect.stringContaining("option non budgétée") }),
    ]));
  });
  it("writes a complete monthly point including each post, club income, restitution and synthesis", () => {
    const posts = [post, { ...post, id: "other", code: "C", label: "Compétitions séniors" }];
    const actions = [pilotageAction({ actualFederation: 50 })];
    const summary = computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: 5000 }, posts, actions });
    const report = buildMonthlyReportText(summary, [{ level: "info", postCode: "B", message: "À valider" }], new Date("2026-09-08"));
    for (const text of ["Point budgétaire COMEH à fin septembre 2026", "1. Stages séniors", "2. Compétitions séniors", "Synthèse", "Budget 2026", "50 %", "contributions club/athlète", "À valider", "Restitution fédé : 5 000 €"]) expect(report).toContain(text);
    expect(report).not.toMatch(/NaN|Infinity/);
  });
});


describe("past events without expenditure", () => {
  it("reports the event with its budget and requires a known situation date", () => {
    const actions = [{ ...pilotageAction({ label: "Doha", plannedMonth: 1, revisedFederation: 12345 }), postCode: "B" }];
    const summary = computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: 0 }, posts: [post], actions });
    expect(listVigilancePoints(summary, actions, { asOfDate: new Date("2026-10-25"), fiscalYearLabel: "2026" })).toContainEqual({
      level: "info", postCode: "B", actionId: "action",
      message: "Doha : événement passé sans dépense enregistrée — annulé ou pas encore facturé ? (12 345 € budgétés)",
    });
    expect(listVigilancePoints(summary, actions)).toEqual([]);
    expect(listVigilancePoints(summary, actions, { asOfDate: null, fiscalYearLabel: "2026" })).toEqual([]);
  });
  it.each([
    [1, "2026-10-25", "BUDGETED", null, null, "COMPETITION", true],
    [10, "2026-10-25", "BUDGETED", null, null, "COMPETITION", false],
    [12, "2026-10-25", "BUDGETED", null, null, "COMPETITION", false],
    [12, "2027-01-01", "BUDGETED", null, null, "TRAINING_CAMP", true],
    [1, "2025-12-31", "BUDGETED", null, null, "COMPETITION", false],
    [null, "2026-10-25", "BUDGETED", null, null, "COMPETITION", false],
    [1, "2026-10-25", "BUDGETED", null, null, "OPERATING", false],
    [1, "2026-10-25", "CANCELLED", null, null, "COMPETITION", false],
    [1, "2026-10-25", "COMMITTED", null, null, "COMPETITION", false],
    [1, "2026-10-25", "DONE", null, null, "COMPETITION", false],
    [1, "2026-10-25", "BUDGETED", 0, null, "COMPETITION", false],
    [1, "2026-10-25", "BUDGETED", null, 0, "COMPETITION", false],
  ] as const)("checks month %s at %s with %s, actuals %s/%s and post %s", (plannedMonth, date, status, actualFederation, actualGross, kind, expected) => {
    const actions = [{ ...pilotageAction({ plannedMonth, status, actualFederation, actualGross }), postCode: "B" }];
    const summary = computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: 0 }, posts: [{ ...post, kind }], actions });
    const points = listVigilancePoints(summary, actions, { asOfDate: new Date(date), fiscalYearLabel: "2026" });
    expect(points.some(point => point.message.includes("événement passé sans dépense"))).toBe(expected);
  });
});
