import path from "node:path";

const uploadRoot = path.resolve(process.cwd(), "storage", "uploads");

export function getUploadRoot() {
  return uploadRoot;
}

export function storedUploadPath(fileName: string) {
  return path.posix.join("storage", "uploads", fileName);
}

export function resolveStoredUpload(fileUrl: string) {
  const absolutePath = path.resolve(process.cwd(), fileUrl);
  const rootPrefix = `${uploadRoot}${path.sep}`;

  if (!absolutePath.startsWith(rootPrefix)) {
    throw new Error("Chemin de fichier d’import invalide");
  }

  return absolutePath;
}

