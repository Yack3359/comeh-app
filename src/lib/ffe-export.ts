import path from "node:path";

import ExcelJS from "exceljs";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "src/lib/templates/ndf-ffe-template.xlsx",
);

const MAPPED_CATEGORIES: Record<string, string> = {
  Parking: "C23",
  Taxi: "C24",
  Transferts: "C25",
  Hôtel: "C28",
  Repas: "C29",
};

type FfeExpenseReportInput = {
  competitionName: string;
  location: string;
  date: Date;
  amountsByCategory: Record<string, number>;
};

function formatCompetitionDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export async function buildFfeExpenseReportWorkbook({
  competitionName,
  location,
  date,
  amountsByCategory,
}: FfeExpenseReportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const sheet = workbook.getWorksheet(1);
  if (!sheet) {
    throw new Error("Le gabarit de note de frais FFE est introuvable.");
  }

  sheet.getCell("C9").value = competitionName;
  sheet.getCell("C10").value = `${location}, le ${formatCompetitionDate(date)}`;

  let otherTotal = 0;
  for (const [category, amount] of Object.entries(amountsByCategory)) {
    const cellAddress = MAPPED_CATEGORIES[category];
    if (cellAddress) {
      if (amount > 0) {
        sheet.getCell(cellAddress).value = Math.round(amount * 100) / 100;
      }
    } else {
      otherTotal += amount;
    }
  }
  if (otherTotal > 0) {
    sheet.getCell("C31").value = Math.round(otherTotal * 100) / 100;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
