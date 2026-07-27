import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  resultRelationError,
  toResultData,
  validateResultRelations,
} from "@/lib/ranking-results";
import {
  entityParamsSchema,
  resultUpdateSchema,
} from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  const parsedParams = entityParamsSchema.safeParse(context.params);
  const parsedBody = resultUpdateSchema.safeParse(
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
      async () => {
        const relationStatus = await validateResultRelations(parsedBody.data);
        if (relationStatus !== "valid") {
          return { status: relationStatus };
        }

        const updated = await prisma.result.update({
          where: { id: parsedParams.data.id },
          data: toResultData(parsedBody.data),
          select: { id: true },
        });
        return { status: "updated" as const, result: updated };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status !== "updated") {
      const relationError = resultRelationError(result.status);
      return NextResponse.json(
        { error: relationError ?? "Relations invalides" },
        { status: 400 },
      );
    }

    return NextResponse.json(result.result);
  } catch (error) {
    return apiErrorResponse(error, "Impossible de modifier le résultat");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const parsedParams = entityParamsSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      () =>
        prisma.result.delete({
          where: { id: parsedParams.data.id },
          select: { id: true },
        }),
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de supprimer le résultat");
  }
}
