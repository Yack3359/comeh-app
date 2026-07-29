export const genderLabels = {
  FEMALE: "Femme",
  MALE: "Homme",
  OTHER: "Autre",
} as const;

export const weaponLabels = {
  EPEE: "Épée",
  FLEURET: "Fleuret",
  SABRE: "Sabre",
} as const;

export const fencingCategoryLabels = {
  SENIOR: "Sénior",
  U23: "U23",
  M20: "M20 (moins de 20 ans)",
  M17: "M17 (moins de 17 ans)",
  M15: "M15",
  M13: "M13",
  VETERAN: "Vétéran",
} as const;

export const handednessLabels = {
  RIGHT_HANDED: "Droitier",
  LEFT_HANDED: "Gaucher",
  UNKNOWN: "Non renseigné",
} as const;

export const gripTypeLabels = {
  CROSS: "Cross",
  STRAIGHT: "Droite",
  UNKNOWN: "Non renseigné",
} as const;

export const playStyleLabels = {
  OFFENSIVE: "Offensif",
  COUNTER_OFFENSIVE: "Contre-offensif",
  DEFENSIVE: "Défensif",
  MIXED: "Mixte",
  OTHER: "Autre",
  UNKNOWN: "Non renseigné",
} as const;

export const groupByLabels = {
  country: "Pays",
  handedness: "Main",
  gripType: "Type de poignet",
  playStyle: "Style de jeu",
} as const;

export function athleteName(
  athlete: Pick<{ firstName: string; lastName: string }, "firstName" | "lastName">,
) {
  return `${athlete.firstName} ${athlete.lastName}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatFencingCategory(value: string) {
  return (
    fencingCategoryLabels[
      value as keyof typeof fencingCategoryLabels
    ] ?? value
  );
}

export function formatCharacteristic(
  groupBy: keyof typeof groupByLabels,
  value: string,
) {
  if (groupBy === "handedness") {
    return handednessLabels[value as keyof typeof handednessLabels] ?? value;
  }
  if (groupBy === "gripType") {
    return gripTypeLabels[value as keyof typeof gripTypeLabels] ?? value;
  }
  if (groupBy === "playStyle") {
    return playStyleLabels[value as keyof typeof playStyleLabels] ?? value;
  }
  return value === "UNKNOWN" ? "Non renseigné" : value;
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;

  if (!response.ok) {
    throw new Error(
      body && typeof body === "object" && "error" in body && body.error
        ? body.error
        : "Une erreur est survenue",
    );
  }

  return body as T;
}
