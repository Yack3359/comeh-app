import { del } from "@vercel/blob";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { importBatchParamsSchema } from "@/lib/import-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

type RouteContext = {
  params: { id: string };
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(_request: Request, context: RouteContext) {
  const parsedParams = importBatchParamsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async (userId) => {
        const batch = await prisma.importBatch.findFirst({
          where: {
            id: parsedParams.data.id,
            userId,
          },
          select: {
            id: true,
            fileUrl: true,
          },
        });

        if (!batch) {
          return { status: "not_found" as const };
        }

        await del(batch.fileUrl).catch(() => {});
        await prisma.importBatch.delete({ where: { id: batch.id } });

        return { status: "deleted" as const };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Import introuvable" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de supprimer cet import");
  }
}
