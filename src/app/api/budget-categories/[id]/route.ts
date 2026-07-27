import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { budgetCategoryUpdateSchema } from "@/lib/budget-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
const paramsSchema = z.object({ id: z.string().trim().min(1).max(64) });

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(request: Request, context: RouteContext) {
  const parsedParams = paramsSchema.safeParse(context.params);
  const parsedBody = budgetCategoryUpdateSchema.safeParse(
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
      () =>
        prisma.budgetCategory.update({
          where: { id: parsedParams.data.id },
          data: parsedBody.data,
          select: {
            id: true,
            name: true,
            seasonId: true,
          },
        }),
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Impossible de modifier la catégorie");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const parsedParams = paramsSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async () => {
        const category = await prisma.budgetCategory.findUnique({
          where: { id: parsedParams.data.id },
          select: {
            id: true,
            _count: {
              select: { expenses: true },
            },
          },
        });

        if (!category) {
          return { status: "not_found" as const };
        }

        if (category._count.expenses > 0) {
          return { status: "in_use" as const };
        }

        await prisma.budgetCategory.delete({
          where: { id: category.id },
        });

        return { status: "deleted" as const };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 });
    }

    if (result.status === "in_use") {
      return NextResponse.json(
        { error: "Cette catégorie contient des frais et ne peut pas être supprimée" },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de supprimer la catégorie");
  }
}

