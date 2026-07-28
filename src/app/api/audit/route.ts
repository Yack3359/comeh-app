import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { auditQuerySchema } from "@/lib/audit-validations";
import { prisma } from "@/lib/prisma";

const adminRoles = [Role.ADMIN] as const;
const pageSize = 20;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsedQuery = auditQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async () => {
        const { page, userId, entityType, from, to } = parsedQuery.data;
        const where: Prisma.AuditLogWhereInput = {
          userId,
          entityType,
          createdAt:
            from || to
              ? {
                  gte: from
                    ? new Date(`${from}T00:00:00.000Z`)
                    : undefined,
                  lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
                }
              : undefined,
        };

        const [items, total, users, entityTypes] = await Promise.all([
          prisma.auditLog.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
            select: {
              id: true,
              action: true,
              entityType: true,
              entityId: true,
              diffJson: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          }),
          prisma.auditLog.count({ where }),
          prisma.user.findMany({
            where: { auditLogs: { some: {} } },
            orderBy: [{ name: "asc" }, { email: "asc" }],
            select: { id: true, name: true, email: true },
          }),
          prisma.auditLog.findMany({
            distinct: ["entityType"],
            orderBy: { entityType: "asc" },
            select: { entityType: true },
          }),
        ]);

        return {
          items,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          },
          filters: {
            users,
            entityTypes: entityTypes.map((item) => item.entityType),
          },
        };
      },
      adminRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de charger le journal d’audit");
  }
}
