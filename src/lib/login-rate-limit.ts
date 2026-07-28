const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

type AttemptRecord = {
  count: number;
  firstAttemptAt: number;
};

/**
 * Limiteur en mémoire par processus : suffisant pour un déploiement mono-instance
 * (ex. Docker self-host). Sur une plateforme serverless multi-instance (Vercel),
 * chaque instance a son propre compteur — à remplacer par un store partagé
 * (Redis) si ce mode de déploiement est retenu.
 */
const attemptsByEmail = new Map<string, AttemptRecord>();

function pruneExpired(now: number) {
  for (const [key, record] of attemptsByEmail) {
    if (now - record.firstAttemptAt > WINDOW_MS) {
      attemptsByEmail.delete(key);
    }
  }
}

export function isLoginRateLimited(email: string): boolean {
  const now = Date.now();
  pruneExpired(now);

  const record = attemptsByEmail.get(email);
  if (!record) {
    return false;
  }

  if (now - record.firstAttemptAt > WINDOW_MS) {
    attemptsByEmail.delete(email);
    return false;
  }

  return record.count >= MAX_ATTEMPTS;
}

export function registerFailedLoginAttempt(email: string): void {
  const now = Date.now();
  const record = attemptsByEmail.get(email);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    attemptsByEmail.set(email, { count: 1, firstAttemptAt: now });
    return;
  }

  record.count += 1;
}

export function clearLoginAttempts(email: string): void {
  attemptsByEmail.delete(email);
}
