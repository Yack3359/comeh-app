import ExcelJS from "exceljs";
import { monthLabel, proposalLabels, teamLabels } from "./budget-pilotage-labels";
import type { loadPreparation } from "./budget-preparation-query";

type PreparationData = NonNullable<Awaited<ReturnType<typeof loadPreparation>>>;
export function buildPreparationWorkbook(data: PreparationData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "COMEH";
  workbook.calcProperties.fullCalcOnLoad = true;
  const budget = workbook.addWorksheet("Budget " + data.fiscalYear.label);
  budget.addRow(["Poste", "Équipe", "Libellé", "Mois", "Tireurs", "Cadres", "Jours", "Décision", "Coût total", "Recettes clubs", "Part FFE", "% FFE", "Chiffré", "Budget FFE N-1", "Réalisé FFE N-1", "Commentaire", "Proposé par"]);
  const subtotals: number[] = [];
  for (const post of data.posts) {
    const lines = data.lines.filter(line => line.postId === post.id);
    const start = budget.rowCount + 1;
    for (const line of lines) budget.addRow([post.code + " — " + post.label, teamLabels[line.team], line.label, monthLabel(line.plannedMonth),
      line.athleteCount, line.staffCount, line.dayCount, line.proposalStatus ? proposalLabels[line.proposalStatus] : "—",
      line.revisedGross, line.revisedClubIncome, line.revisedFederation, line.revisedGross ? line.revisedFederation / line.revisedGross : 0,
      line.amountsConfirmed ? "Oui" : "Non", line.source?.revisedFederation ?? null, line.source?.actualFederation ?? null, line.comment, line.proposedByName]);
    const row = budget.addRow(["Sous-total " + post.code]);
    subtotals.push(row.number);
    for (const [column, field] of [[9, "revisedGross"], [10, "revisedClubIncome"], [11, "revisedFederation"]] as const) {
      const letter = String.fromCharCode(64 + column);
      row.getCell(column).value = { formula: lines.length ? "SUM(" + letter + start + ":" + letter + (row.number - 1) + ")" : "SUM(0)", result: lines.reduce((total, line) => total + line[field], 0) };
    }
    for (const [column, field] of [[14, "revisedFederation"], [15, "actualFederation"]] as const) {
      const letter = String.fromCharCode(64 + column);
      row.getCell(column).value = { formula: lines.length ? "SUM(" + letter + start + ":" + letter + (row.number - 1) + ")" : "SUM(0)", result: lines.reduce((sum, line) => sum + (line.source?.[field] ?? 0), 0) };
    }
    row.getCell(12).value = { formula: "IFERROR(K" + row.number + "/I" + row.number + ",0)", result: lines.reduce((sum, line) => sum + line.revisedGross, 0) ? lines.reduce((sum, line) => sum + line.revisedFederation, 0) / lines.reduce((sum, line) => sum + line.revisedGross, 0) : 0 };
  }
  const total = budget.addRow(["Total des propositions (toutes décisions)"]);
  for (const [column, field] of [[9, "revisedGross"], [10, "revisedClubIncome"], [11, "revisedFederation"]] as const) {
    const letter = String.fromCharCode(64 + column);
    total.getCell(column).value = { formula: "SUM(" + (subtotals.map(row => letter + row).join(",") || "0") + ")", result: data.lines.reduce((sum, line) => sum + line[field], 0) };
  }
  for (const [column, field] of [[14, "revisedFederation"], [15, "actualFederation"]] as const) {
    const letter = String.fromCharCode(64 + column);
    total.getCell(column).value = { formula: "SUM(" + (subtotals.map(row => letter + row).join(",") || "0") + ")", result: data.lines.reduce((sum, line) => sum + (line.source?.[field] ?? 0), 0) };
  }
  const totalGross = data.lines.reduce((sum, line) => sum + line.revisedGross, 0);
  total.getCell(12).value = { formula: "IFERROR(K" + total.number + "/I" + total.number + ",0)", result: totalGross ? data.lines.reduce((sum, line) => sum + line.revisedFederation, 0) / totalGross : 0 };
  const construction = workbook.addWorksheet("Construction");
  construction.addRow(["Hypothèse", "Poste", "Coût total", "Clubs et tireurs", "Part FFE", "% FFE", "Budget FFE N-1", "Réalisé FFE N-1", "Écart"]);
  for (const [label, variant] of [["Lignes retenues", data.construction.retained], ["Hypothèse haute", data.construction.high]] as const) {
    for (const post of [...variant.posts, { ...variant.totals, code: "", label: "Total" }]) construction.addRow([label, (post.code ? post.code + " — " : "") + post.label,
      post.gross, post.clubIncome, post.federation, post.federationPercent / 100, post.previousBudget, post.previousActual, post.variance]);
  }
  for (const sheet of workbook.worksheets) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.eachRow(row => row.eachCell(cell => { cell.font = { name: "Arial", size: 10 }; cell.alignment = { vertical: "top", wrapText: true }; }));
    sheet.getRow(1).eachCell(cell => { cell.font = { name: "Arial", size: 10, bold: true }; });
    sheet.columns.forEach(column => { column.width = 22; });
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  for (const row of [...subtotals, total.number]) budget.getRow(row).eachCell(cell => { cell.font = { name: "Arial", size: 10, bold: true }; });
  for (const column of [9, 10, 11, 14, 15]) budget.getColumn(column).numFmt = '# ##0 €';
  for (const column of [3, 4, 5, 7, 8, 9]) construction.getColumn(column).numFmt = '# ##0 €';
  budget.getColumn(12).numFmt = '0%'; construction.getColumn(6).numFmt = '0%';
  budget.getColumn(1).width = 40; budget.getColumn(3).width = 52; budget.getColumn(16).width = 60;
  construction.getColumn(2).width = 44;
  return workbook;
}
