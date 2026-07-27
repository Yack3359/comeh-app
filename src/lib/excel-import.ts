import * as XLSX from "xlsx";

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function readFirstSheetAsRows(buffer: Buffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  return rawRows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = String(value ?? "").trim();
    }
    return normalized;
  });
}

function firstNonEmpty(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    if (row[key]) {
      return row[key];
    }
  }
  return "";
}

export type ExcelExpenseRow = {
  amount: string;
  date: string;
  type: string;
  description: string;
  relatedEvent: string;
  category: string;
};

/**
 * Colonnes attendues (insensible à la casse/accents) : montant, date, type
 * (hebergement|deplacement), description, categorie, evenement (optionnel).
 */
export function parseExpensesExcel(buffer: Buffer): ExcelExpenseRow[] {
  return readFirstSheetAsRows(buffer)
    .map((row) => ({
      amount: firstNonEmpty(row, ["montant", "amount"]),
      date: firstNonEmpty(row, ["date"]),
      type: firstNonEmpty(row, ["type"]).toLowerCase(),
      description: firstNonEmpty(row, ["description", "libelle", "objet"]),
      relatedEvent: firstNonEmpty(row, [
        "evenement",
        "competition",
        "deplacement",
      ]),
      category: firstNonEmpty(row, ["categorie", "category"]),
    }))
    .filter((row) => row.amount || row.description);
}

export type ExcelResultRow = {
  athleteName: string;
  opponentName: string;
  competitionName: string;
  date: string;
  rank: string;
  won: string;
  score: string;
  round: string;
};

/**
 * Colonnes attendues : athlete, adversaire (optionnel), competition, date,
 * rang (optionnel), victoire (oui/non, optionnel), score (optionnel), tour (optionnel).
 */
export function parseResultsExcel(buffer: Buffer): ExcelResultRow[] {
  return readFirstSheetAsRows(buffer)
    .map((row) => ({
      athleteName: firstNonEmpty(row, ["athlete", "tireur"]),
      opponentName: firstNonEmpty(row, ["adversaire", "opponent"]),
      competitionName: firstNonEmpty(row, ["competition"]),
      date: firstNonEmpty(row, ["date"]),
      rank: firstNonEmpty(row, ["rang", "rank", "classement"]),
      won: firstNonEmpty(row, ["victoire", "won", "resultat"]),
      score: firstNonEmpty(row, ["score"]),
      round: firstNonEmpty(row, ["tour", "round", "phase"]),
    }))
    .filter((row) => row.athleteName);
}
