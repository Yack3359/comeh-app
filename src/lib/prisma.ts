import { Prisma, PrismaClient } from "@prisma/client";

import { getAuditContext } from "@/lib/audit-context";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const auditedActions = new Set<Prisma.PrismaAction>([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

const actionLabels: Partial<Record<Prisma.PrismaAction, string>> = {
  create: "CREATE",
  createMany: "CREATE_MANY",
  update: "UPDATE",
  updateMany: "UPDATE_MANY",
  upsert: "UPSERT",
  delete: "DELETE",
  deleteMany: "DELETE_MANY",
};

function modelDelegateName(model: string) {
  return `${model.charAt(0).toLowerCase()}${model.slice(1)}`;
}

const sensitiveKeys = new Set(["password", "passwordHash", "password_hash"]);

function sanitizeForAudit(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeForAudit);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        sensitiveKeys.has(key) ? "[REDACTED]" : sanitizeForAudit(entryValue),
      ]),
    );
  }

  return value;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(sanitizeForAudit(value)),
  ) as Prisma.InputJsonValue;
}

async function findPreviousValue(
  client: PrismaClient,
  model: string,
  action: Prisma.PrismaAction,
  args: Record<string, unknown>,
) {
  if (!["update", "upsert", "delete"].includes(action) || !args.where) {
    return null;
  }

  const delegate = (
    client as unknown as Record<
      string,
      { findUnique: (query: { where: unknown }) => Promise<unknown> }
    >
  )[modelDelegateName(model)];

  return delegate?.findUnique({ where: args.where });
}

function entityId(result: unknown, previousValue: unknown, args: Record<string, unknown>) {
  const candidates = [result, previousValue, args.where];

  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === "object" &&
      "id" in candidate &&
      typeof candidate.id === "string"
    ) {
      return candidate.id;
    }
  }

  return "*";
}

function registerAuditMiddleware(client: PrismaClient) {
  client.$use(async (params, next) => {
    const context = getAuditContext();
    const shouldAudit =
      context &&
      params.model &&
      params.model !== "AuditLog" &&
      auditedActions.has(params.action);

    if (!shouldAudit || !context || !params.model) {
      return next(params);
    }

    const args = (params.args ?? {}) as Record<string, unknown>;
    const before = await findPreviousValue(client, params.model, params.action, args);
    const result = await next(params);

    await client.auditLog.create({
      data: {
        userId: context.userId,
        action: actionLabels[params.action] ?? params.action.toUpperCase(),
        entityType: params.model,
        entityId: entityId(result, before, args),
        diffJson: toJson({
          before,
          after: ["delete", "deleteMany"].includes(params.action) ? null : result,
          input: ["createMany", "updateMany", "deleteMany"].includes(params.action)
            ? args
            : undefined,
        }),
      },
    });

    return result;
  });
}

function createPrismaClient() {
  const client = new PrismaClient();
  registerAuditMiddleware(client);
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
