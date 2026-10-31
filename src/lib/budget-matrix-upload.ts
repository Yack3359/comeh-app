import { z } from "zod";
import { parseBudgetMatrix } from "./budget-matrix";

export const matrixFileSchema = z.custom<File>(value =>
  typeof value === "object" && value !== null && "arrayBuffer" in value && typeof value.arrayBuffer === "function" && "name" in value,
  "Sélectionnez un fichier Excel .xlsx",
).refine(file => /\.xlsx$/i.test(file.name), "Seuls les fichiers .xlsx sont acceptés")
  .refine(file => file.size > 0, "Le fichier sélectionné est vide")
  .refine(file => file.size <= 5 * 1024 * 1024, "Fichier trop volumineux : la limite est de 5 Mo");

export class MatrixUploadError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
export async function readMatrixUpload(request: Request) {
  if (Number(request.headers.get("content-length")) > 6 * 1024 * 1024) {
    throw new MatrixUploadError("Fichier trop volumineux : le formulaire dépasse 6 Mo", 413);
  }
  const form = await request.formData().catch(() => { throw new MatrixUploadError("Le formulaire d’upload est invalide"); });
  const validation = matrixFileSchema.safeParse(form.get("file"));
  if (!validation.success) throw new MatrixUploadError(validation.error.issues[0].message);
  const file = validation.data;
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseBudgetMatrix(buffer, file.name).catch(() => {
    throw new MatrixUploadError("La lecture du fichier Excel a échoué. Vérifiez son format.");
  });
  if (!parsed.posts.length) throw new MatrixUploadError("Aucun poste budgétaire trouvé dans le fichier");
  return { form, file, buffer, parsed };
}
