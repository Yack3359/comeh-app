import { SecurityEventType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type RecordSecurityEventInput = {
  type: SecurityEventType;
  email?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  detail?: string | null;
};

/**
 * Best-effort : une erreur ici (base indisponible, etc.) ne doit jamais
 * empêcher une connexion ou une requête de se poursuivre. On avale l'erreur
 * après un log console, la journalisation de sécurité n'est pas critique
 * au point de bloquer l'application.
 */
export async function recordSecurityEvent(input: RecordSecurityEventInput) {
  try {
    await prisma.securityEvent.create({
      data: {
        type: input.type,
        email: input.email?.trim().toLowerCase() || null,
        userId: input.userId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        detail: input.detail ?? null,
      },
    });
  } catch (error) {
    console.error("Impossible d'enregistrer l'événement de sécurité", error);
  }
}

/** Extrait l'IP cliente au mieux depuis les en-têtes habituels des proxys (Vercel, etc.). */
export function extractClientIp(headers: Headers | Record<string, string | string[] | undefined>) {
  const get = (key: string): string | undefined => {
    if (headers instanceof Headers) {
      return headers.get(key) ?? undefined;
    }
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const forwardedFor = get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim();
  }

  return get("x-real-ip");
}
