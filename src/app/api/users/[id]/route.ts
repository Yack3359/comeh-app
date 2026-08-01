import { Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import {
  userIdParamsSchema,
  userUpdateSchema,
} from "@/lib/user-validations";

const adminRoles = [Role.ADMIN] as const;
const lastAdminError =
  "Impossible de supprimer/rétrograder le dernier administrateur";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(request: Request, context: RouteContext) {
  const parsedParams = userIdParamsSchema.safeParse(context.params);
  const parsedBody = userUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }

  if (!parsedBody.success) {
    return invalidDataResponse(parsedBody.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async (currentUserId) => {
        const user = await prisma.user.findUnique({
          where: { id: parsedParams.data.id },
          select: { id: true, role: true },
        });

        if (!user) {
          return { status: "not_found" as const };
        }

        const losesAdminAccess =
          (parsedBody.data.role !== undefined &&
            parsedBody.data.role !== Role.ADMIN) ||
          parsedBody.data.disabled === true;

        if (
          user.id === currentUserId &&
          (parsedBody.data.disabled === true || losesAdminAccess)
        ) {
          return { status: "self" as const };
        }

        if (
          user.role === Role.ADMIN &&
          losesAdminAccess &&
          (await prisma.user.count({ where: { role: Role.ADMIN } })) <= 1
        ) {
          return { status: "last_admin" as const };
        }

        const { password, ...data } = parsedBody.data;
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            ...data,
            passwordHash: password ? await hash(password, 12) : undefined,
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            disabled: true,
            createdAt: true,
          },
        });

        return { status: "updated" as const, user: updatedUser };
      },
      adminRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    if (result.status === "self") {
      return NextResponse.json(
        { error: "Vous ne pouvez pas modifier vos propres accès de cette façon" },
        { status: 409 },
      );
    }

    if (result.status === "last_admin") {
      return NextResponse.json({ error: lastAdminError }, { status: 409 });
    }

    return NextResponse.json(result.user);
  } catch (error) {
    return apiErrorResponse(error, "Impossible de modifier le membre");
  }
}

/**
 * "Supprime" un membre au sens de révoquer son accès : on désactive le
 * compte (disabled = true) plutôt que de le supprimer physiquement. Un vrai
 * DELETE échouerait de toute façon dès que ce membre a la moindre entrée
 * d'audit, de frais ou d'import à son nom (contraintes onDelete: Restrict),
 * et supprimer l'historique d'un membre qui a réellement utilisé l'outil
 * n'est de toute façon pas souhaitable pour la traçabilité.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const parsedParams = userIdParamsSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async (currentUserId) => {
        if (parsedParams.data.id === currentUserId) {
          return { status: "self" as const };
        }

        const user = await prisma.user.findUnique({
          where: { id: parsedParams.data.id },
          select: { id: true, role: true, disabled: true },
        });

        if (!user) {
          return { status: "not_found" as const };
        }

        if (
          user.role === Role.ADMIN &&
          (await prisma.user.count({ where: { role: Role.ADMIN } })) <= 1
        ) {
          return { status: "last_admin" as const };
        }

        if (!user.disabled) {
          await prisma.user.update({
            where: { id: user.id },
            data: { disabled: true },
          });
        }

        return { status: "disabled" as const };
      },
      adminRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status === "self") {
      return NextResponse.json(
        { error: "Vous ne pouvez pas désactiver votre propre compte" },
        { status: 409 },
      );
    }

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    if (result.status === "last_admin") {
      return NextResponse.json({ error: lastAdminError }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de désactiver le membre");
  }
}
