import { put } from "@vercel/blob";

async function uploadPrivateFile(
  directory: "imports" | "expenses",
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
