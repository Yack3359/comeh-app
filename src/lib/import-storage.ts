import { put } from "@vercel/blob";

export async function uploadImportFile(
  buffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  const pathname = `imports/${fileName}`;

  await put(pathname, buffer, {
    access: "private",
    contentType,
  });

  return pathname;
}
