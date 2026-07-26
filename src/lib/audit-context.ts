import { AsyncLocalStorage } from "node:async_hooks";

type AuditContext = {
  userId: string;
};

const auditContext = new AsyncLocalStorage<AuditContext>();

export function runWithAuditContext<T>(
  userId: string,
  operation: () => Promise<T>,
): Promise<T> {
  return auditContext.run({ userId }, operation);
}

export function getAuditContext() {
  return auditContext.getStore();
}
