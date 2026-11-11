import { describe, expect, it } from "vitest";
import { buildPilotageWorkbook } from "../budget-pilotage-export";
import { computeActionFigures, computeFiscalYearSummary } from "../budget-pilotage";
import { pilotageAction, post } from "./budget-fixtures";

describe("pilotage Excel export", () => {
  it("exports the commission comment immediately after matrix notes", () => {
    const actions = [{ ...pilotageAction(), postCode: post.code, fencingCategories: [],
      notes: "Note de la matrice", comment: "Décision de la commission", entered: { amount: 1234.56, count: 3, notBooked: 234.56 } }];
    const summary = computeFiscalYearSummary({
      fiscalYear: { label: "2026", restitutionAmount: 0 }, posts: [post], actions,
    });
    const sheet = buildPilotageWorkbook({ summary, actions, vigilance: [] }).getWorksheet("Actions")!;
    expect(sheet.getRow(1).getCell(18).value).toBe("Notes");
    expect(sheet.getRow(1).getCell(19).value).toBe("Commentaire");
    expect(sheet.getRow(2).getCell(18).value).toBe("Note de la matrice");
    expect(sheet.getRow(2).getCell(19).value).toBe("Décision de la commission");
    expect(sheet.getRow(2).getCell(9).value).toBe(100);
    expect(sheet.getRow(1).cellCount).toBe(21);
    expect([20, 21].map(column => sheet.getRow(1).getCell(column).value)).toEqual(["Saisi notes de frais", "Non repris par la fédé"]);
    expect([20, 21].map(column => sheet.getRow(2).getCell(column).value)).toEqual([1234.56, 234.56]);
    expect(sheet.getRow(3).getCell(9).value).toEqual({ formula: "SUM(I2:I2)", result: 100 });
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
    expect([20, 21].map(column => details.getRow(2).getCell(column).value)).toEqual([0, 0]);
  });
});

describe("export par mois", () => {
  it("ajoute les douze mois, Sans mois et Total après les feuilles existantes", () => {
    const asOfDate = new Date("2026-10-25");
    const actions = [pilotageAction({ plannedMonth: 7, status: "DONE", actualFederation: 20 }),
      pilotageAction({ plannedMonth: 9, status: "DONE", actualFederation: 30 }), pilotageAction({ actualFederation: 10 })]
      .map(action => ({ ...action, postCode: post.code, fencingCategories: [], notes: null, comment: null,
        figures: computeActionFigures(action, { asOfDate, fiscalYearLabel: "2026" }) }));
    const summary = computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: 0 }, posts: [post], actions, asOfDate });
    const workbook = buildPilotageWorkbook({ summary, actions, vigilance: [], asOfDate });
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(["Synthèse", "Actions", "Vigilance", "Par mois"]);
    const sheet = workbook.getWorksheet("Par mois")!;
    const values = (row: number) => Array.from({ length: 7 }, (_, index) => sheet.getRow(row).getCell(index + 1).value);
    expect(sheet.rowCount).toBe(15);
    expect(values(1)).toEqual(["Mois", "Actions", "Budget FFE", "Réalisé FFE", "Reste à venir FFE", "Atterrissage FFE (total)", "Marge"]);
    expect(values(2)).toEqual(["janv.", 0, 0, 0, 0, 0, 0]);
    expect(values(8)).toEqual(["juil.", 1, 100, 20, 0, 20, 80]);
    expect(values(10)).toEqual(["sept.", 1, 100, 30, 70, 100, 0]);
    expect(values(13)).toEqual(["déc.", 0, 0, 0, 0, 0, 0]);
    expect(values(14)).toEqual(["Sans mois", 1, 100, 10, 90, 100, 0]);
    expect(values(15)).toEqual(["Total", 3, 300, 60, 160, 220, 80]);
    expect(sheet.getRow(15).getCell(1).font.bold).toBe(true);
    expect(sheet.getRow(15).getCell(7).font.bold).toBe(true);
    expect([3, 4, 5, 6, 7].map(column => sheet.getColumn(column).numFmt)).toEqual(Array(5).fill('# ##0 €'));
    expect(sheet.getRow(15).getCell(6).value).toBe(summary.totals.landing);
  });
  it("calcule les figures manquantes avec la date de situation et garde Sans mois à zéro", () => {
    const asOfDate = new Date("2026-10-25");
    const actions = [{ ...pilotageAction({ status: "DONE", plannedMonth: 7, actualFederation: 20 }), postCode: post.code, fencingCategories: [], notes: null, comment: null }];
    const summary = computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: 0 }, posts: [post], actions, asOfDate });
    const sheet = buildPilotageWorkbook({ summary, actions, vigilance: [], asOfDate }).getWorksheet("Par mois")!;
    expect(sheet.getRow(8).getCell(6).value).toBe(20);
    expect(sheet.getRow(14).getCell(1).value).toBe("Sans mois");
    expect(sheet.getRow(14).getCell(2).value).toBe(0);
    expect(sheet.getRow(15).getCell(6).value).toBe(20);
  });
});
