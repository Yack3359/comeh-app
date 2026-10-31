import { describe, expect, it } from "vitest";
import { buildPilotageWorkbook } from "../budget-pilotage-export";
import { computeFiscalYearSummary } from "../budget-pilotage";
import { pilotageAction, post } from "./budget-fixtures";

describe("pilotage Excel export", () => {
  it("exports the commission comment immediately after matrix notes", () => {
    const actions = [{ ...pilotageAction(), postCode: post.code, fencingCategories: [],
      notes: "Note de la matrice", comment: "Décision de la commission" }];
    const summary = computeFiscalYearSummary({
      fiscalYear: { label: "2026", restitutionAmount: 0 }, posts: [post], actions,
    });
    const sheet = buildPilotageWorkbook({ summary, actions, vigilance: [] }).getWorksheet("Actions")!;
    expect(sheet.getRow(1).getCell(18).value).toBe("Notes");
    expect(sheet.getRow(1).getCell(19).value).toBe("Commentaire");
    expect(sheet.getRow(2).getCell(18).value).toBe("Note de la matrice");
    expect(sheet.getRow(2).getCell(19).value).toBe("Décision de la commission");
    expect(sheet.getRow(2).getCell(9).value).toBe(100);
  });
});

describe("realized, remaining and landing export", () => {
  it("uses the situation date and exports matching detail and summary totals", () => {
    const asOfDate = new Date("2026-10-25");
    const actions = [7, 9].map(plannedMonth => ({ ...pilotageAction({ status: "DONE", plannedMonth, actualFederation: 20 }),
      postCode: "B", fencingCategories: [], notes: null, comment: null }));
    const summary = computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: 0 }, posts: [post], actions, asOfDate });
    const workbook = buildPilotageWorkbook({ summary, actions, vigilance: [], asOfDate });
    const synthesis = workbook.getWorksheet("Synthèse")!;
    const details = workbook.getWorksheet("Actions")!;
    expect([4, 5, 6].map(column => synthesis.getRow(1).getCell(column).value)).toEqual(["Réalisé", "Reste à venir", "Atterrissage (total)"]);
    expect([4, 5, 6].map(column => synthesis.getRow(2).getCell(column).value)).toEqual([40, 80, 120]);
    expect([10, 11, 12].map(column => details.getRow(2).getCell(column).value)).toEqual([20, 0, 20]);
    expect([10, 11, 12].map(column => details.getRow(3).getCell(column).value)).toEqual([20, 80, 100]);
    expect(details.getRow(4).getCell(11).value).toEqual({ formula: "SUM(K2:K3)", result: 80 });
  });
});
