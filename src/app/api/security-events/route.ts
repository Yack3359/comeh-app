import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { securityEventQuerySchema } from "@/lib/security-event-validations";

const adminRoles = [Role.ADMIN] as const;
const pageSize = 25;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsedQuery = securityEventQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return invalidDataResponse(parsedQuery.error);
  }

  try {
    const result = await runAsAuthenticatedUser(async () => {
      const { page, type } = parsedQuery.data;
      const where: Prisma.SecurityEventWhereInput = { type };

      const [items, total, failedLoginsLast24h] = await Promise.all([
        prisma.securityEvent.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            type: true,
            email: true,
            ipAddress: true,
            userAgent: true,
            detail: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.securityEvent.count({ where }),
        prisma.securityEvent.count({
          where: {
            type: "LOGIN_FAILURE",
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
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
        failedLoginsLast24h,
      };
    }, adminRoles);

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Impossible de charger le journal de sécurité",
    );
  }
}
