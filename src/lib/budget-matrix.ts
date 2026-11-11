import ExcelJS from "exceljs";
import { isPlannedMonthPast } from "./budget-date";
import { roundAmount } from "./budget-amount";
export { roundAmount } from "./budget-amount";

export type FencingCategoryValue = "SENIOR" | "U23" | "M20" | "M17" | "M15" | "M13";
export type MatrixAction = {
  rowNumber: number; postCode: string; lineNumber: number | null; lineOccurrence: number | null; label: string;
  matrixKey: string; origin: "RENEWED" | "NEW" | null;
  includedInBudget: boolean; proposedSaving: boolean;
  gross: number | null; clubIncome: number | null; federation: number | null;
  estimatedFederation: number | null; previousYear: number | null; actualGross: number | null;
  actualClubIncome: number | null; actualFederation: number | null;
  notes: string | null; fencingCategories: FencingCategoryValue[]; plannedMonth: number | null;
  suggestedStatus: "OPTION" | "BUDGETED" | "DONE" | "UNBUDGETED";
};
type Totals = { gross: number | null; clubIncome: number | null; federation: number | null };
export type MatrixPost = {
  code: string; label: string; kind: "OPERATING" | "TRAINING_CAMP" | "COMPETITION" | "OTHER";
  rowNumber: number; sortOrder: number; totals: Totals;
};
export type ParsedMatrix = {
  sheetName: string; fiscalYearLabel: string | null; asOfDate: string | null;
  restitutionAmount: number | null;
  posts: MatrixPost[]; actions: MatrixAction[]; grandTotals: Totals | null;
  ignoredRows: Array<{ rowNumber: number; text: string }>; warnings: string[];
};

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const stopWords = new Set("fait option pers personnes cadre cadres jours j eq et ou de du la le les a au en ffe".split(" "));
export function normalizeMatrixLabel(label: string): string {
  return [...new Set(normalize(label).replace(/[^a-z0-9]+/g, " ").split(" ")
    .filter(token => token.length >= 2 && !/^\d+$/.test(token) && !stopWords.has(token)))].sort().join(" ");
}
export function inferFencingCategories(label: string, postLabel: string): FencingCategoryValue[] {
  const tokens = (value: string) => normalize(value).match(/\b(?:m13|m15|m17|m20|u23)\b/g) ?? [];
  const own = tokens(label);
  const found = new Set((own.length ? own : tokens(postLabel)).map(token => token.toUpperCase()));
  if (!found.size && /senior/.test(normalize(label + " " + postLabel))) found.add("SENIOR");
  return (["SENIOR", "U23", "M20", "M17", "M15", "M13"] as const).filter(value => found.has(value));
}
export function inferPlannedMonth(label: string): number | null {
  const text = normalize(label);
  const names = [
    "janv|jan|janvier", "fev|fevr|fevrier", "mars", "avr|avril", "mai", "juin",
    "juil|juillet", "aout", "sept|septembre", "oct|octobre", "nov|novembre", "dec|decembre",
  ];
  const candidates: Array<{ position: number; month: number }> = [];
  names.forEach((name, index) => {
    const match = new RegExp("\\b(?:" + name + ")\\b").exec(text);
    if (match) candidates.push({ position: match.index, month: index + 1 });
  });
  for (const match of text.matchAll(/\b(\d{1,2})\/(\d{2})(?!\d)/g)) {
    const first = Number(match[1]), second = Number(match[2]);
    const month = second >= 1 && second <= 12 && first >= 1 && first <= 31
      ? second : first >= 1 && first <= 12 && second > 12 ? first : null;
    if (month !== null) candidates.push({ position: match.index!, month });
  }
  return candidates.sort((a, b) => a.position - b.position)[0]?.month ?? null;
}
export function inferEstimateFromLabel(label: string): number | null {
  const matches = [...label.matchAll(/(\d+(?:[.,]\d+)?)\s*k\b/gi)];
  const last = matches.at(-1);
  return last ? roundAmount(Number(last[1].replace(",", ".")) * 1000) : null;
}
function actionNumberOf(cell: ExcelJS.Cell): number | null {
  const value = cell.value;
  if (value && typeof value === "object" && ("formula" in value || "sharedFormula" in value) && value.result === 0) return null;
  return numberOf(cell);
}
function restitutionFrom(cell: ExcelJS.Cell): number | null {
  const value = cell.value;
  if (!value || typeof value !== "object" || !("formula" in value || "sharedFormula" in value)) return null;
  const formula = (cell.formula ?? "").replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'/g, "");
  const constants = [...formula.matchAll(/\+\s*(\d+(?:\.\d+)?)(?![\w.])/g)];
  return constants.length ? roundAmount(constants.reduce((sum, match) => sum + Number(match[1]), 0)) : null;
}
function valueOf(value: ExcelJS.CellValue): string | number | null {
  if (typeof value === "number" || typeof value === "string") return value;
  if (value && typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) return typeof value.result === "number" ? value.result : null;
    if ("richText" in value) return value.richText.map(part => part.text).join("");
    if ("text" in value) return value.text;
  }
  return null;
}
function textOf(cell: ExcelJS.Cell): string {
  return String(valueOf(cell.value) ?? "").replace(/\s+/g, " ").trim();
}
function numberOf(cell: ExcelJS.Cell): number | null {
  const value = valueOf(cell.value);
  if (value === null || (typeof value === "string" && !value.trim())) return null;
  const number = typeof value === "number" ? value : Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(number) ? roundAmount(number) : null;
}
function subtotalRows(cell: ExcelJS.Cell): Set<number> {
  const value = cell.value;
  const formula = value && typeof value === "object" && ("formula" in value || "sharedFormula" in value)
    ? cell.formula : "";
  const rows = new Set<number>();
  for (const match of (formula ?? "").matchAll(/(?:^|[^A-Z0-9_])\$?D\$?(\d+)(?:\s*:\s*\$?D\$?(\d+))?/gi)) {
    const start = Number(match[1]), end = Number(match[2] ?? start);
    for (let row = Math.min(start, end); row <= Math.min(Math.max(start, end), 1048576); row++) rows.add(row);
  }
  return rows;
}
function dateFrom(text: string, fileName = false): string | null {
  const match = (fileName ? /au\s+(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/i
    : /realise\s+au\s+(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/i).exec(normalize(text));
  if (!match) return null;
  const year = match[3].length === 2 ? "20" + match[3] : match[3];
  const iso = year + "-" + match[2].padStart(2, "0") + "-" + match[1].padStart(2, "0");
  const date = new Date(iso + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}
export async function parseBudgetMatrix(buffer: Buffer | ArrayBuffer, fileName?: string): Promise<ParsedMatrix> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);
  if (workbook.worksheets.some(sheet => sheet.rowCount > 2000 || sheet.columnCount > 60)) {
    throw new Error("La matrice dépasse la limite de 2 000 lignes ou 60 colonnes par feuille");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Le classeur ne contient aucune feuille");
  const result: ParsedMatrix = {
    sheetName: sheet.name, fiscalYearLabel: null, asOfDate: null,
    restitutionAmount: null, posts: [], actions: [], grandTotals: null, ignoredRows: [], warnings: [],
  };
  for (const [column, expected] of [["D", "depenses"], ["E", "recette"], ["F", "reel"], ["G", "previ"], ["J", "realise"]]) {
    const header = normalize([1, 2, 3].map(row => textOf(sheet.getCell(column + row))).join(" "));
    if (!header.includes(expected)) result.warnings.push("En-tête " + expected + " absent en colonne " + column + " : colonnes par défaut utilisées");
  }
  result.fiscalYearLabel = [textOf(sheet.getCell("C1")), textOf(sheet.getCell("D1")), sheet.name]
    .map(text => text.match(/\b20\d{2}\b/)?.[0]).find(Boolean) ?? null;
  const rowText = (row: ExcelJS.Row) => {
    const cells: string[] = [];
    row.eachCell(cell => { const text = textOf(cell); if (text) cells.push(text); });
    return cells.join(" | ");
  };
  result.asOfDate = dateFrom(rowText(sheet.getRow(1)) + " " + rowText(sheet.getRow(2))) ?? dateFrom(fileName ?? "", true);
  const totals = (row: ExcelJS.Row): Totals => ({
    gross: numberOf(row.getCell("D")), clubIncome: numberOf(row.getCell("E")), federation: numberOf(row.getCell("F")),
  });
  let current: MatrixPost | undefined;
  let included = new Set<number>();
  const occurrences = new Map<string, Map<number, number>>();
  let ended = false;
  sheet.eachRow((row, rowNumber) => {
    const text = rowText(row);
    const label = textOf(row.getCell("C")), marker = textOf(row.getCell("B"));
    if (ended) { if (text) result.ignoredRows.push({ rowNumber, text }); return; }
    if (normalize(label).startsWith("total lignes detaillees")) { ended = true; return; }
    if (/^[A-Z]$/i.test(marker)) {
      const normalized = normalize(label);
      current = {
        code: marker.toUpperCase(), label, rowNumber, sortOrder: result.posts.length, totals: totals(row),
        kind: /stage/.test(normalized) ? "TRAINING_CAMP" : /competition/.test(normalized) ? "COMPETITION"
          : /frais|fonctionnement|commission/.test(normalized) ? "OPERATING" : "OTHER",
      };
      result.posts.push(current);
      included = subtotalRows(row.getCell("D"));
      if (!included.size) result.warnings.push("Formule de sous-total absente pour le poste " + current.code + " : inclusion déduite des libellés OPTION");
      return;
    }
    if (!current && normalize(label).startsWith("commission")) {
      result.grandTotals = totals(row);
      result.restitutionAmount = restitutionFrom(row.getCell("M"));
      return;
    }
    const lineNumber = numberOf(row.getCell("B"));
    if (current && (lineNumber !== null || (!marker && label))) {
      const gross = actionNumberOf(row.getCell("D")), clubIncome = actionNumberOf(row.getCell("E"));
      const federation = actionNumberOf(row.getCell("F")) ?? (gross === null ? null : roundAmount(gross - (clubIncome ?? 0)));
      const actualGross = actionNumberOf(row.getCell("J")), actualClubIncome = actionNumberOf(row.getCell("K"));
      const actualFederation = actionNumberOf(row.getCell("L")) ?? (actualGross === null ? null : roundAmount(actualGross - (actualClubIncome ?? 0)));
      const noAmounts = [gross, clubIncome, federation, actionNumberOf(row.getCell("G")), actualGross, actualClubIncome, actualFederation].every(v => v === null);
      const hasBudgetAmount = [gross, federation, actualGross, actualClubIncome, actualFederation].some(v => v !== null);
      const unbudgeted = (!marker && gross === null) || noAmounts;
      const includedInBudget = !unbudgeted && hasBudgetAmount && (included.size ? included.has(rowNumber) : !/\boption\b/i.test(label));
      let proposedSaving = false;
      for (let col = 3; col <= 14; col++) {
        const fill = row.getCell(col).fill;
        if (fill?.type === "pattern" && /0099FF$/i.test(fill.fgColor?.argb ?? "")) proposedSaving = true;
      }
      const origin = textOf(row.getCell("A")).toUpperCase();
      const postOccurrences = occurrences.get(current.code) ?? new Map<number, number>();
      occurrences.set(current.code, postOccurrences);
      const lineOccurrence = lineNumber === null ? null : postOccurrences.get(lineNumber) ?? 0;
      if (lineNumber !== null && lineOccurrence !== null) postOccurrences.set(lineNumber, lineOccurrence + 1);
      const plannedMonth = inferPlannedMonth(label);
      const completed = (actualFederation !== null || actualGross !== null) && (
        /\bfait\b/.test(normalize(label)) || (current.kind !== "OPERATING" &&
          isPlannedMonthPast(plannedMonth, result.asOfDate ? new Date(result.asOfDate) : null, result.fiscalYearLabel))
      );
      result.actions.push({
        rowNumber, postCode: current.code, lineNumber, lineOccurrence, label, matrixKey: normalizeMatrixLabel(label),
        origin: origin === "IDEM" ? "RENEWED" : origin === "NEWS" ? "NEW" : null,
        includedInBudget, proposedSaving,
        gross: unbudgeted ? 0 : gross, clubIncome: unbudgeted ? 0 : clubIncome, federation: unbudgeted ? 0 : federation,
        estimatedFederation: unbudgeted ? inferEstimateFromLabel(label) : null,
        previousYear: actionNumberOf(row.getCell("G")), actualGross, actualClubIncome, actualFederation,
        notes: textOf(row.getCell("N")) || null,
        fencingCategories: inferFencingCategories(label, current.label), plannedMonth,
        suggestedStatus: unbudgeted ? "UNBUDGETED" : !includedInBudget ? "OPTION"
          : completed ? "DONE" : "BUDGETED",
      });
    } else if (text) result.ignoredRows.push({ rowNumber, text });
  });
  return result;
}
