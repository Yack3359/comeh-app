import type { BudgetActionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildMonthlyReportText, computeActionFigures, computeFiscalYearSummary, computePostSummary, isActionSettled, listVigilancePoints } from "../budget-pilotage";
import { pilotageAction, post } from "./budget-fixtures";

describe("action figures", () => {
  it.each([
    ["CANCELLED", null, null, 0], ["CANCELLED", 20, 90, 20],
    ["DONE", null, null, 100], ["DONE", 0, null, 100], ["DONE", 20, 90, 90],
    ["OPTION", 20, 90, 20],
    ["BUDGETED", null, null, 100], ["BUDGETED", 120, 90, 120], ["BUDGETED", 20, 90, 90],
    ["COMMITTED", null, null, 100], ["COMMITTED", 120, 90, 120],
    ["UNBUDGETED", null, null, 0], ["UNBUDGETED", 20, null, 20], ["UNBUDGETED", 20, 90, 90],
  ] as const)("computes landing for %s / actual %s / estimated %s", (status: BudgetActionStatus, actualFederation: number | null, estimatedFederation: number | null, landing: number) => {
    expect(computeActionFigures(pilotageAction({ status, actualFederation, estimatedFederation })).landing).toBe(landing);
  });
  it("excludes options, unbudgeted and unincluded rows from the budget, with positive overspend", () => {
    for (const patch of [{ status: "OPTION" as const }, { status: "UNBUDGETED" as const }, { includedInBudget: false }]) {
      expect(computeActionFigures(pilotageAction({ ...patch, actualFederation: 20 }))).toMatchObject({ budget: 0, actual: 20, variance: 20, remaining: 0 });
    }
    expect(computeActionFigures(pilotageAction({ actualFederation: 110 }))).toMatchObject({ variance: 10, remaining: 0 });
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
    expect(summary.totals).toMatchObject({ budget: 160, initialBudget: 160, actual: 20, landing: 50, margin: 110, remaining: 30, options: 40, unbudgeted: 30, proposedSavings: 60, gross: { budget: 300 }, clubIncome: { budget: 100 } });
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
      expect.objectContaining({ message: expect.stringContaining("hors budget") }),
      expect.objectContaining({ message: expect.stringContaining("économie proposée à valider") }),
      expect.objectContaining({ message: expect.stringContaining("option non budgétée") }),
    ]));
    expect(points.filter(point => point.actionId === "over")).toHaveLength(1);
    expect(points.filter(point => point.actionId === "outside")).toHaveLength(1);
  });
  it("counts an adjustment in the budget, also for an unbudgeted action, and reports it", () => {
    expect(computeActionFigures(pilotageAction({ revisedFederation: 10000, adjustmentFederation: 2000 })).budget).toBe(12000);
    const outside = pilotageAction({ id: "berne", status: "UNBUDGETED", includedInBudget: false, adjustmentFederation: 15000, estimatedFederation: 27000 });
    expect(computeActionFigures(outside)).toMatchObject({ budget: 15000, landing: 27000 });
    const actions = [{ ...outside, postCode: "B" }];
    const summary = computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: 0 }, posts: [post], actions });
    const points = listVigilancePoints(summary, actions);
    expect(points).toHaveLength(1);
    expect(points[0].level).toBe("orange");
    expect(buildMonthlyReportText(summary, points, new Date("2026-10-25"))).toContain("15 000 € de rallonge / ajustement");
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

describe("settlement and remaining invoices", () => {
  const context = { asOfDate: new Date("2026-10-25"), fiscalYearLabel: "2026" };
  it.each([
    [true, "BUDGETED", "Stage", null, true], [false, "DONE", "Stage FAIT", 1, false],
    [null, "DONE", "Stage FAIT", null, true], [null, "DONE", "Stage FÂIT", null, true],
    [null, "DONE", "Stage forfait", null, false], [null, "BUDGETED", "Stage FAIT", 1, false],
    [null, "DONE", "Stage", 7, true], [null, "DONE", "Stage", 8, true],
    [null, "DONE", "Stage", 9, false], [null, "DONE", "Stage", 10, false],
    [null, "DONE", "Stage", null, false],
  ] as const)("settles %s / %s / %s / month %s as %s", (settled, status, label, plannedMonth, expected) => {
    const action = pilotageAction({ settled, status, label, plannedMonth, actualFederation: 20 });
    expect(isActionSettled(action, context)).toBe(expected);
    expect(computeActionFigures(action, context)).toMatchObject({ actual: 20, remaining: expected ? 0 : 80, landing: expected ? 20 : 100 });
  });
  it("uses the fiscal year across year boundaries and requires a situation date for month inference", () => {
    const action = pilotageAction({ status: "DONE", plannedMonth: 12 });
    expect(isActionSettled(action, { asOfDate: new Date("2027-01-01"), fiscalYearLabel: "2026" })).toBe(false);
    expect(isActionSettled(action, { asOfDate: new Date("2027-02-01"), fiscalYearLabel: "2026" })).toBe(true);
    expect(isActionSettled(action)).toBe(false);
  });
  it("keeps options at zero budget even with adjustments, includes actuals and clamps remaining to zero", () => {
    expect(computeActionFigures(pilotageAction({ status: "OPTION", adjustmentFederation: 50, actualFederation: 20 })))
      .toMatchObject({ budget: 0, actual: 20, remaining: 0, landing: 20 });
    expect(computeActionFigures(pilotageAction({ status: "OPTION" }))).toMatchObject({ actual: 0, remaining: 0, landing: 0 });
    expect(computeActionFigures(pilotageAction({ adjustmentFederation: 50, actualFederation: 20 })))
      .toMatchObject({ budget: 150, remaining: 130, landing: 150 });
    expect(computeActionFigures(pilotageAction({ settled: true, actualFederation: null }))).toMatchObject({ remaining: 0, landing: 0 });
  });
  it("aggregates actual plus remaining and keeps the global margin based on landing", () => {
    const actions = [pilotageAction({ status: "DONE", plannedMonth: 7, actualFederation: 20 }),
      pilotageAction({ status: "DONE", plannedMonth: 9, actualFederation: 30 }),
      pilotageAction({ status: "OPTION", actualFederation: 10 })];
    const summary = computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: 5 }, posts: [post], actions, asOfDate: context.asOfDate });
    expect(summary.totals).toMatchObject({ budget: 200, actual: 60, remaining: 70, landing: 130 });
    expect(summary.posts[0]).toMatchObject({ actual: 60, remaining: 70, landing: 130 });
    expect(summary.globalMargin).toBe(65);
    const report = buildMonthlyReportText(summary, [], context.asOfDate);
    expect(report).toContain("Reste à venir : 70 €");
    expect(report).toContain("Réalisé : 60 € | Reste à venir : 70 € | Atterrissage (total) : 130 €");
  });
});
