import type { ImportExtractionEnvelope } from "./types";

export async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : {
            "Content-Type": "application/json",
            ...init?.headers,
          },
  });
  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    const details =
      payload?.details && typeof payload.details === "object"
        ? Object.values(payload.details as Record<string, unknown>)
            .flat()
            .find((value): value is string => typeof value === "string")
        : null;
    throw new Error(
      (typeof payload?.error === "string" && payload.error) ||
        details ||
        "La requête a échoué",
    );
  }

  return payload as T;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function textValue(value: unknown) {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : "";
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function isImportEnvelope(
  value: unknown,
): value is ImportExtractionEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const envelope = value as Partial<ImportExtractionEnvelope>;
  return (
    envelope.version === 1 &&
    (envelope.target === "expense" || envelope.target === "result") &&
    typeof envelope.seasonId === "string" &&
    typeof envelope.mimeType === "string" &&
    typeof envelope.originalName === "string" &&
    Array.isArray(envelope.rows) &&
    Array.isArray(envelope.validatedRowIndexes)
  );
}

