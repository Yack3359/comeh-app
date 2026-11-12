import ExcelJS from "exceljs";
import { roundAmount } from "./budget-amount";

export function buildMatrixWorkbook({ fiscalYearLabel, asOfDate, restitutionAmount, posts, actions }: {
  fiscalYearLabel: string; asOfDate: Date; restitutionAmount: number;
  posts: Array<{ id: string; code: string; label: string }>;
  actions: Array<{ postId: string; label: string; matrixLineNumber: number | null; origin: "RENEWED" | "NEW" | null;
    includedInBudget: boolean; proposedSaving: boolean; revisedGross: number; revisedClubIncome: number; revisedFederation: number;
    previousYearAmount: number | null; actualGross: number | null; actualClubIncome: number | null; actualFederation: number | null; notes: string | null }>;
}): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "COMEH";
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = workbook.addWorksheet("EH " + fiscalYearLabel);
  const date = asOfDate.toISOString().slice(0, 10).split("-").reverse().join("/");
  for (const [cell, value] of Object.entries({ C1: "EH " + fiscalYearLabel, D2: "DÉPENSES", E2: "Recettes clubs", F2: "Réel FFE", G2: "PREVI N-1",
    J1: "REALISE AU " + date, J2: "Dépenses", K2: "Recettes clubs", L2: "Réel FFE", N2: "Commentaires", C3: "COMMISSION EPEE HOMMES" })) sheet.getCell(cell).value = value;
  sheet.mergeCells("J1:L1");
  const columns = ["D", "E", "F", "J", "K", "L"] as const;
  function setFormula(address: string, formula: string, result: number) {
    sheet.getCell(address).value = { formula, result };
  }
  function subtotal(row: number, rows: number[]) {
    for (const column of columns) {
      const result = roundAmount(rows.reduce((sum, number) => {
        const cell = sheet.getCell(column + number);
        return sum + Number(cell.result ?? cell.value ?? 0);
      }, 0));
      setFormula(column + row, "SUM(" + (rows.length ? rows.map(number => column + number).join(",") : "0") + ")", result);
    }
  }
  const postRows: number[] = [], actionRows: number[] = [];
  let next = 4;
  for (const [postIndex, post] of posts.entries()) {
    if (postIndex) next++;
    const postRow = next++;
    postRows.push(postRow);
    sheet.getCell("B" + postRow).value = post.code;
    sheet.getCell("C" + postRow).value = post.label;
    const includedRows: number[] = [];
    for (const [index, action] of actions.filter(action => action.postId === post.id).entries()) {
      const row = next++;
      actionRows.push(row);
      if (action.includedInBudget) includedRows.push(row);
      for (const [column, value] of Object.entries({ A: action.origin === "RENEWED" ? "IDEM" : action.origin === "NEW" ? "NEWS" : null,
        B: action.matrixLineNumber ?? index + 1, C: action.label, D: action.revisedGross, E: action.revisedClubIncome, F: action.revisedFederation,
        G: action.previousYearAmount, J: action.actualGross, K: action.actualClubIncome, L: action.actualFederation, N: action.notes })) sheet.getCell(column + row).value = value;
      if (action.proposedSaving) for (let column = 3; column <= 14; column++) sheet.getRow(row).getCell(column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0099FF" } };
    }
    subtotal(postRow, includedRows);
  }
  subtotal(3, postRows);
  setFormula("M3", "SUM(0)+" + restitutionAmount, restitutionAmount);
  sheet.getCell("C" + next).value = "TOTAL LIGNES DETAILLEES";
  subtotal(next, actionRows);
  sheet.views = [{ state: "frozen", ySplit: 3 }];
  sheet.eachRow(row => row.eachCell(cell => { cell.font = { name: "Arial", size: 10 }; cell.alignment = { vertical: "top", wrapText: true }; }));
  for (const row of [1, 2, 3, ...postRows, next]) sheet.getRow(row).eachCell(cell => { cell.font = { name: "Arial", size: 10, bold: true }; });
  sheet.columns.forEach(column => { column.width = 18; });
  sheet.getColumn("A").width = 10;
  sheet.getColumn("B").width = 8;
  sheet.getColumn("C").width = 60;
  sheet.getColumn("N").width = 60;
  for (const column of [...columns, "G", "M"]) sheet.getColumn(column).numFmt = '# ##0 €';
  return workbook;
}
