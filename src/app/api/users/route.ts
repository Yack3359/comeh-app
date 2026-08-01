import { Prisma, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { userCreateSchema } from "@/lib/user-validations";

const adminRoles = [Role.ADMIN] as const;

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  disabled: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runAsAuthenticatedUser(
      () =>
        prisma.user.findMany({
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: userSelect,
        }),
      adminRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de charger les membres");
  }
}

export async function POST(request: Request) {
  const parsedBody = userCreateSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedBody.success) {
    return invalidDataResponse(parsedBody.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async () => {
        const { password, ...userData } = parsedBody.data;

        return prisma.user.create({
          data: {
            ...userData,
            passwordHash: await hash(password, 12),
          },
          select: userSelect,
        });
      },
      adminRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cette adresse e-mail" },
        { status: 409 },
      );
    }

    return apiErrorResponse(error, "Impossible de créer le membre");
  }
}
