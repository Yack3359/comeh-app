import { put } from "@vercel/blob";

async function uploadPrivateFile(
  directory: "imports" | "expenses" | "budget-matrices",
  buffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  const pathname = `${directory}/${fileName}`;

  await put(pathname, buffer, {
    access: "private",
    contentType,
  });

  return pathname;
}

export async function uploadImportFile(
  buffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  return uploadPrivateFile("imports", buffer, fileName, contentType);
}

export async function uploadExpenseAttachment(
  buffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  return uploadPrivateFile("expenses", buffer, fileName, contentType);
}

export async function uploadBudgetMatrixFile(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const safeName = fileName.split(/[\\/]/).pop()!
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || "matrice.xlsx";
  return uploadPrivateFile(
    "budget-matrices", buffer, `${Date.now()}-${safeName}`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
