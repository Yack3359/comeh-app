import ExcelJS from "exceljs";
import type { MatrixAction, ParsedMatrix } from "../budget-matrix";
import type { ExistingAction } from "../budget-matrix-diff";
import type { PilotageAction, PilotagePost } from "../budget-pilotage";

export function matrixAction(overrides: Partial<MatrixAction> = {}): MatrixAction {
  return {
    rowNumber: 8, postCode: "B", lineNumber: 1, lineOccurrence: 0, label: "Stage Laupheim M20 avril", matrixKey: "avril laupheim m20 stage",
    origin: "RENEWED", includedInBudget: true, proposedSaving: false, gross: 5000, clubIncome: 1000, federation: 4000,
    estimatedFederation: null, previousYear: 3500, actualGross: null, actualClubIncome: null, actualFederation: null,
    notes: null, fencingCategories: ["M20"], plannedMonth: 4, suggestedStatus: "BUDGETED", ...overrides,
  };
}
export function existingAction(overrides: Partial<ExistingAction> = {}): ExistingAction {
  return {
    id: "old", postCode: "B", label: "Stage Laupheim M20 avril", matrixKey: "avril laupheim m20 stage",
    matrixLineNumber: 1, matrixOccurrence: 0, sortOrder: 0, estimatedFederation: null,
    status: "BUDGETED", includedInBudget: true, proposedSaving: false,
    revisedGross: 5000, revisedClubIncome: 1000, revisedFederation: 4000,
    actualGross: null, actualClubIncome: null, actualFederation: null, previousYearAmount: 3500, notes: null, ...overrides,
  };
}
export function parsedMatrix(actions = [matrixAction()]): ParsedMatrix {
  return { sheetName: "EH 2026", fiscalYearLabel: "2026", asOfDate: "2026-09-08",
    posts: [{ code: "B", label: "Stages M20-M17", kind: "TRAINING_CAMP", rowNumber: 7, sortOrder: 0,
      totals: { gross: 5000, clubIncome: 1000, federation: 4000 } }],
    actions, restitutionAmount: null, grandTotals: null, ignoredRows: [], warnings: [] };
}
export const post: PilotagePost = { id: "post-b", code: "B", label: "Stages séniors", kind: "TRAINING_CAMP" };
export function pilotageAction(overrides: Partial<PilotageAction> = {}): PilotageAction {
  return { id: "action", postId: post.id, label: "Stage", plannedMonth: null, settled: null, status: "BUDGETED", includedInBudget: true, proposedSaving: false,
    initialFederation: 80, revisedFederation: 100, adjustmentFederation: 0, estimatedFederation: null, actualFederation: null,
    revisedGross: 150, revisedClubIncome: 50, actualGross: null, actualClubIncome: null, ...overrides };
}
export function matrixWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("EH 2026");
  for (const [cell, value] of Object.entries({
    C1: "EH 2026", D2: "DÉPENSES", E2: "Recettes clubs", F2: "Réel FFE", G2: "PREVI N-1", J1: "REALISE AU 25/10/2026",
    C3: "COMMISSION EPEE HOMMES", D3: 100000, E3: 30000, F3: 70000,
    B4: "A", C4: "Frais de commissions", B5: 1, C5: "Frais de commissions", D5: 7070, E5: 0, F5: 7070, G5: 7000, J5: 2544, L5: 2544,
    B7: "B", C7: "Stages séniors", B8: 1, C8: "Stage janvier", D8: 4000,
    A9: "NEWS", B9: 2, C9: "Budapest (HUN) 16-20 mars: ? Pers ? J => FAIT", D9: 1500, F9: 1500, G9: 7500, J9: 9628, L9: 9628,
    A14: "IDEM", B14: 7, C14: " 6  Regroupements (INSEP) OPTION ", D14: 3600, F14: 3600, N14: "x",
    B15: 8, C15: "Stage OPTION", D15: 2000,
    B16: "C", C16: "Compétitions séniors", B18: 2, C18: "Doha GP (QAT) 24-25 jan", D18: 30500, E18: 19500, G18: 8000, J18: 20302, K18: 13640,
    C25: "Berne 12/26 (27K)",
    B26: 3, C26: "Compétition novembre", D26: 1000,
    B27: "D", C27: "Stages M20-M17", B28: 1, C28: "M17 Insep prép CEE 15-17 Fev", D28: "1 574", N28: "devis 2026 non facturé",
    B29: 1, C29: "M20 CREPS REIMS Preparation CM Avril", D29: 2000,
    B32: "E", C32: "Compétitions M20-M17", B33: 1, C33: "Laupheim M20 avril", D33: 1000,
    B34: 2, C34: "Coupe OPTION", D34: 500, B35: 1, C35: "Autre compétition", D35: 250,
    C39: "Thessalonique (Grec) => 6k", C46: "M17 Kaglenfurt (6K)",
    C57: "TOTAL LIGNES DETAILLEES", C58: "VERIFICATION", D58: 0, C59: "manama 6000", C60: "FUJARIAH PROV 2025 12013.81",
  })) sheet.getCell(cell).value = value;
  sheet.getCell("M3").value = { formula: "SUM(M4:M56)+5000", result: 5000 };
  sheet.getCell("F39").value = { formula: "SUM(D39-E39)", result: 0 };
  sheet.getCell("F46").value = { formula: "SUM(D46-E46)", result: 0 };
  sheet.getCell("L26").value = { formula: "SUM(J26-K26)", result: 0 };
  sheet.getCell("L5").value = { formula: "J5", result: 2544 };
  sheet.getCell("D4").value = { formula: "D5+D6", result: 10160 };
  sheet.getCell("D7").value = { formula: "$D$8+D9+D10+D11+D12+D13", result: 5500 };
  sheet.getCell("D16").value = { formula: "SUM(D17:D26)", result: 30500 };
  sheet.getCell("D27").value = 3574;
  sheet.getCell("D32").value = { formula: "SUM($D$33:$D$45)", result: 1750 };
  sheet.getCell("L28").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0099FF" } };
  sheet.getCell("C29").value = { richText: [{ text: "M20 CREPS " }, { text: "REIMS Preparation CM Avril" }] };
  return workbook;
}
