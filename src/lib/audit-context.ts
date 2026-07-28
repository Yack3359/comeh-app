import { AsyncLocalStorage } from "node:async_hooks";

type AuditContext = {
  userId: string;
};

/**
 * Next.js (webpack dev mode) peut instancier ce module séparément par route ;
 * si `auditContext` était un simple singleton de module, le middleware Prisma
 * (dont le client est mis en cache sur globalThis) et les routes API risquent
 * chacun de lire/écrire sur une instance AsyncLocalStorage différente, et le
 * contexte d'audit ne traverserait jamais la frontière. On le fixe donc lui
 * aussi sur globalThis pour garantir une instance unique par processus.
 */
const globalForAuditContext = globalThis as unknown as {
  auditContext?: AsyncLocalStorage<AuditContext>;
};

const auditContext =
  globalForAuditContext.auditContext ?? new AsyncLocalStorage<AuditContext>();

globalForAuditContext.auditContext = auditContext;

export function runWithAuditContext<T>(
  userId: string,
  operation: () => Promise<T>,
): Promise<T> {
  // `run()` doit recevoir une fonction `async` qui `await` réellement
  // l'opération : si on se contente de renvoyer la Promise (sans `await`),
  // la suite de la chaîne (et donc la requête Prisma déclenchée à l'intérieur)
  // s'exécute hors du contexte AsyncLocalStorage établi ici, et le middleware
  // d'audit ne voit plus l'utilisateur courant.
  return auditContext.run({ userId }, async () => await operation());
}

export function getAuditContext() {
  return auditContext.getStore();
}
