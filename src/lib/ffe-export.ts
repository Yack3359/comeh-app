import * as XLSX from "xlsx";

type FfeExpenseReportInput = {
  competitionName: string;
  location: string;
  date: Date;
  amountsByCategory: Record<string, number>;
};

const MAPPED_CATEGORIES = new Set([
  "Parking",
  "Taxi",
  "Transferts",
  "Hôtel",
  "Repas",
]);

function roundAmount(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function amountCell(amount: number): number | "" {
  return amount > 0 ? roundAmount(amount) : "";
}

function formatCompetitionDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function buildFfeExpenseReportWorkbook({
  competitionName,
  location,
  date,
  amountsByCategory,
}: FfeExpenseReportInput) {
  const rows: (string | number)[][] = Array.from({ length: 49 }, () =>
    Array<string | number>(10).fill(""),
  );

  rows[0][0] = "                     NOTE DE FRAIS";
  rows[1][0] = "Nom :";
  rows[2][0] = "Prénom :";
  rows[3][0] = "Adresse :";
  rows[4][0] = "Code postal - Ville :";
  rows[5][0] = "Courriel :";
  rows[6][0] = "Portable :";
  rows[7][0] =
    "Compétition           Stage           Arbitrage          Autres       Référent CNA";
  rows[8][0] = "Objet de la mission :";
  rows[8][2] = competitionName;
  rows[9][0] = "Date et lieu :";
  rows[9][2] = `${location}, le ${formatCompetitionDate(date)}`;
  rows[10][0] = "FRAIS ENGAGÉS ";
  rows[11][0] =
    "Tout justificatif manquant ne sera pas remboursé. Les reçus de CB ne sont pas recevables.";
  rows[12][0] = "Véhicule personnel : remboursement limité à 1000 km AR";
  rows[13][0] = "Lieu de départ :";
  rows[13][3] = "Lieu d'arrivée : ";
  rows[13][6] = "Nb Km AR :";
  rows[14][0] = "0,33 € / km";
  rows[15][0] = "Si covoiturage : ";
  rows[15][6] = "Nb Km AR :";
  rows[16][0] = "0,44 € / km";
  rows[17][0] = "Indiquer les noms des personnes : ";
  rows[17][1] = "1-";
  rows[17][4] = "3-";
  rows[18][1] = "2-";
  rows[18][4] = "4-";
  rows[19][0] = "Location de véhicule (1) :";
  rows[20][0] = "Essence (si pas de remboursement km) :";
  rows[21][0] = "Péage (1) :";
  rows[22][0] = "Parking (1) :";
  rows[22][2] = amountCell(amountsByCategory.Parking ?? 0);
  rows[23][0] = "Taxi (1) :";
  rows[23][2] = amountCell(amountsByCategory.Taxi ?? 0);
  rows[24][0] = "Transport en commun (1) :";
  rows[24][2] = amountCell(amountsByCategory.Transferts ?? 0);
  rows[25][0] =
    "Avion (sous réserve d'accord préalable de la Direction Générale) (1+2) :";
  rows[26][0] = "Train (1) :";
  rows[27][0] = "Hebergement (1+3) :";
  rows[27][2] = amountCell(amountsByCategory["Hôtel"] ?? 0);
  rows[28][0] = "Repas (1) :";
  rows[28][2] = amountCell(amountsByCategory.Repas ?? 0);
  rows[29][0] = "Téléphone (1) :";
  rows[30][0] = "Autres frais :";

  const amountEntries = Object.entries(amountsByCategory);
  const otherExpenses = amountEntries.reduce(
    (total, [category, amount]) =>
      MAPPED_CATEGORIES.has(category) ? total : total + amount,
    0,
  );
  rows[30][2] = amountCell(otherExpenses);

  rows[31][0] = "ARBITRAGE";
  rows[32][2] = "Niveau";
  rows[32][3] = "Indemnités";
  rows[32][5] = "Nb jour";
  rows[33][0] = "Indemnités journalières arbitrage (5)";
  rows[33][9] = "Régional";
  rows[34][0] = "Indemnité d'éloignement (6)";
  rows[34][9] = "National";
  rows[35][0] = "Prime d'assiduité";
  rows[35][9] = "International";
  rows[36][0] = "Prime des finales (7)";
  rows[37][0] = "TOTAL A PAYER";
  rows[37][2] = amountCell(
    amountEntries.reduce((total, [, amount]) => total + amount, 0),
  );
  rows[38][0] = "Date et Signature :";
  rows[38][2] = "Visa du responsable :";
  rows[38][5] = "Visa de la Direction Générale :";
  rows[39][2] = "Nom :";
  rows[39][5] = "Nom :";
  rows[41][0] = "(1) Joindre les justificatifs Originaux";
  rows[41][3] =
    "(5) Indemnités arbitrage : indiquer le niveau arbitrage (Régional, National ou International)  ";
  rows[42][0] = "(2) Après accord préalable de la FFE ";
  rows[42][3] =
    "Ind. Journalières arbitrage : International A/B (100€), International C (80€), National (70€) et Régional (45€)";
  rows[43][0] =
    "(3) Hôtel 90 euros en Région Parisienne et 75 euros en Province, avec justificatifs";
  rows[43][3] = "(6) Uniquement à l'étranger";
  rows[44][0] = "(4) Repas 25 euros maximum avec justificatifs";
  rows[44][3] =
    "(7) La prime de finale ne s'applique qu'aux circuits élite senior ";
  rows[46][0] = "A envoyer à : ";
  rows[47][0] =
    "Fédération Française d'Escrime - 7 porte de Neuilly - 93160 NOISY LE GRAND";
  rows[48][0] = "NB : Justificatifs manquants  = Retour de la NDF";

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "NDF");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
