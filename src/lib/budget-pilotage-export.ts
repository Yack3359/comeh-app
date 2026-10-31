import ExcelJS from "exceljs";
import { computeActionFigures, type FiscalYearSummary, type PilotageAction, type VigilancePoint } from "./budget-pilotage";
import { categoryLabels, flagLabels, monthLabel, statusLabels } from "./budget-pilotage-labels";

type ExportAction = PilotageAction & { postCode: string; fencingCategories: Array<keyof typeof categoryLabels>; notes: string | null; comment: string | null };
export function buildPilotageWorkbook({ summary, actions, vigilance }: {
  summary: FiscalYearSummary; actions: ExportAction[]; vigilance: VigilancePoint[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "COMEH";
  workbook.calcProperties.fullCalcOnLoad = true;
  const synthesis = workbook.addWorksheet("Synthèse");
  synthesis.addRow(["Poste", "Budget FFE", "Dont rallonges", "Réalisé", "Reste", "Atterrissage", "Marge", "Drapeau"]);
  for (const post of summary.posts) synthesis.addRow([
    post.code + " — " + post.label, post.budget, post.adjustments, post.actual, post.remaining, post.landing, post.margin, flagLabels[post.flag],
  ]);
  const total = synthesis.addRow(["Total"]);
  for (const [index, key] of (["budget", "adjustments", "actual", "remaining", "landing", "margin"] as const).entries()) {
    const column = String.fromCharCode(66 + index);
    total.getCell(index + 2).value = { formula: summary.posts.length ? "SUM(" + column + "2:" + column + (total.number - 1) + ")" : "SUM(0)", result: summary.totals[key] };
  }
  total.getCell(8).value = flagLabels[summary.flag];
  const restitution = synthesis.addRow(["Restitution fédé", summary.restitution]);
  const margin = synthesis.addRow(["Marge globale"]);
  margin.getCell(2).value = { formula: "SUM(G" + total.number + ",-B" + restitution.number + ")", result: summary.globalMargin };
  const details = workbook.addWorksheet("Actions");
  details.addRow(["Poste", "Libellé", "Statut", "Mois", "Catégories", "Budget initial FFE", "Budget révisé FFE", "Rallonge / ajustement FFE", "Budget total FFE", "Réalisé FFE", "Écart", "Atterrissage FFE", "Brut budgété", "Recettes budgétées", "Brut réalisé", "Recettes réalisées", "Notes", "Commentaire"]);
  for (const action of actions) {
    const figures = computeActionFigures(action);
    details.addRow([action.postCode, action.label, statusLabels[action.status], monthLabel(action.plannedMonth),
      action.fencingCategories.map(category => categoryLabels[category]).join(", "),
      action.initialFederation, action.revisedFederation, action.adjustmentFederation, figures.budget, figures.actual, figures.variance, figures.landing,
      action.revisedGross, action.revisedClubIncome, action.actualGross, action.actualClubIncome, action.notes, action.comment]);
  }
  const actionTotals = details.addRow(["Total"]);
  for (let column = 6; column <= 16; column++) {
    const letter = String.fromCharCode(64 + column);
    const result = actions.reduce((sum, _action, index) => sum + Number(details.getRow(index + 2).getCell(column).value ?? 0), 0);
    actionTotals.getCell(column).value = { formula: actions.length ? "SUM(" + letter + "2:" + letter + (actionTotals.number - 1) + ")" : "SUM(0)", result };
  }
  const alerts = workbook.addWorksheet("Vigilance");
  alerts.addRow(["Niveau", "Poste", "Message"]);
  for (const point of vigilance) alerts.addRow([{ red: "Rouge", orange: "Orange", info: "Information" }[point.level], point.postCode, point.message]);
  for (const sheet of workbook.worksheets) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.eachRow(row => row.eachCell(cell => { cell.font = { name: "Arial", size: 10 }; cell.alignment = { vertical: "top", wrapText: true }; }));
    sheet.getRow(1).eachCell(cell => { cell.font = { name: "Arial", size: 10, bold: true }; });
    sheet.columns.forEach(column => { column.width = 22; });
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  synthesis.getColumn(1).width = 44;
  synthesis.getColumn(8).width = 44;
  details.getColumn(2).width = 52;
  details.getColumn(17).width = 60;
  details.getColumn(18).width = 60;
  alerts.getColumn(3).width = 110;
  for (let column = 2; column <= 7; column++) synthesis.getColumn(column).numFmt = '# ##0 €';
  for (let column = 6; column <= 16; column++) details.getColumn(column).numFmt = '# ##0 €';
  for (const row of [total, restitution, margin, actionTotals]) row.eachCell(cell => { cell.font = { name: "Arial", size: 10, bold: true }; });
  return workbook;
}
