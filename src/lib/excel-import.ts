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
  seedRank: string;
  poolRank: string;
  won: string;
  scoreFor: string;
  scoreAgainst: string;
  round: string;
};

/** Sépare un score combiné "15-12" en 2 valeurs, colonne unique tolérée en secours. */
function splitCombinedScore(value: string): [string, string] {
  const match = value.match(/(\d+)\s*[-–]\s*(\d+)/);
  return match ? [match[1], match[2]] : ["", ""];
}

/**
 * Colonnes attendues : athlete, adversaire (optionnel), competition, date,
 * rang (optionnel), classement initial (optionnel), classement poule
 * (optionnel), victoire (oui/non, optionnel), score pour/score contre (ou à
 * défaut une colonne "score" combinée du type "15-12"), tour (optionnel).
 */
export function parseResultsExcel(buffer: Buffer): ExcelResultRow[] {
  return readFirstSheetAsRows(buffer)
    .map((row) => {
      const combinedScore = firstNonEmpty(row, ["score"]);
      const [fallbackFor, fallbackAgainst] = splitCombinedScore(combinedScore);

      return {
        athleteName: firstNonEmpty(row, ["athlete", "tireur"]),
        opponentName: firstNonEmpty(row, ["adversaire", "opponent"]),
        competitionName: firstNonEmpty(row, ["competition"]),
        date: firstNonEmpty(row, ["date"]),
        rank: firstNonEmpty(row, ["rang", "rank", "classement"]),
        seedRank: firstNonEmpty(row, ["classement_initial", "seed_rank"]),
        poolRank: firstNonEmpty(row, ["classement_poule", "pool_rank"]),
        won: firstNonEmpty(row, ["victoire", "won", "resultat"]),
        scoreFor:
          firstNonEmpty(row, ["score_pour", "score_tireur"]) || fallbackFor,
        scoreAgainst:
          firstNonEmpty(row, ["score_contre", "score_adversaire"]) ||
          fallbackAgainst,
        round: firstNonEmpty(row, ["tour", "round", "phase"]),
      };
    })
    .filter((row) => row.athleteName);
}
