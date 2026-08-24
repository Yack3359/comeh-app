import { randomUUID } from "node:crypto";

import { del, get } from "@vercel/blob";
import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { uploadExpenseAttachment } from "@/lib/import-storage";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
const paramsSchema = z.object({ id: z.string().trim().min(1).max(64) });
const MEBIBYTE = 1024 * 1024;
const MAX_FILE_SIZE = 15 * MEBIBYTE;

const mimeExtensions: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const expenseSelect = Prisma.validator<Prisma.ExpenseSelect>()({
  id: true,
  seasonId: true,
  categoryId: true,
  fencingCategory: true,
  amount: true,
  date: true,
  description: true,
  source: true,
  attachmentUrl: true,
  competitionId: true,
  category: {
    select: { name: true },
  },
  season: {
    select: { label: true },
  },
  competition: {
    select: { id: true, name: true, location: true, date: true },
  },
  createdBy: {
    select: { name: true },
  },
});

type RouteContext = {
  params: { id: string };
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function expenseResponse(
  expense: Prisma.ExpenseGetPayload<{ select: typeof expenseSelect }>,
) {
  return {
    ...expense,
    amount: expense.amount.toString(),
  };
}

function inlineContentDisposition(pathname: string) {
  const fileName = pathname.split("/").pop() || "justificatif";
  const safeFileName = fileName.replace(/["\\]/g, "_").slice(0, 180);

  return `inline; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function POST(request: Request, context: RouteContext) {
  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async () => {
        const formData = await request.formData().catch(() => null);
        if (!formData) {
          return { status: "invalid_form" as const };
        }

        const file = formData.get("file");
        if (!(file instanceof File)) {
          return { status: "missing_file" as const };
        }

        const extension = mimeExtensions[file.type];
        if (!extension) {
          return { status: "invalid_type" as const };
        }

        if (file.size === 0) {
          return { status: "empty_file" as const };
        }

        if (file.size > MAX_FILE_SIZE) {
          return { status: "file_too_large" as const };
        }

        const existingExpense = await prisma.expense.findUnique({
          where: { id: parsedParams.data.id },
          select: { id: true, attachmentUrl: true },
        });
        if (!existingExpense) {
          return { status: "not_found" as const };
        }

        const pathname = await uploadExpenseAttachment(
          Buffer.from(await file.arrayBuffer()),
          `${existingExpense.id}-${randomUUID()}${extension}`,
          file.type,
        );

        const expense = await prisma.expense.update({
          where: { id: existingExpense.id },
          data: { attachmentUrl: pathname },
          select: expenseSelect,
        });

        if (existingExpense.attachmentUrl) {
          await del(existingExpense.attachmentUrl).catch(() => {});
        }

        return { status: "updated" as const, expense };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status === "invalid_form") {
      return NextResponse.json(
        { error: "Le formulaire d’upload est invalide" },
        { status: 400 },
      );
    }
    if (result.status === "missing_file") {
      return NextResponse.json(
        { error: "Sélectionnez un justificatif" },
        { status: 400 },
      );
    }
    if (result.status === "invalid_type") {
      return NextResponse.json(
        {
          error:
            "Type de fichier refusé. Formats acceptés : PDF, JPEG, PNG, GIF et WebP.",
        },
        { status: 415 },
      );
    }
    if (result.status === "empty_file") {
      return NextResponse.json(
        { error: "Le fichier sélectionné est vide" },
        { status: 400 },
      );
    }
    if (result.status === "file_too_large") {
      return NextResponse.json(
        { error: "Fichier trop volumineux : la limite est de 15 Mo." },
        { status: 413 },
      );
    }
    if (result.status === "not_found") {
      return NextResponse.json({ error: "Frais introuvable" }, { status: 404 });
    }

    return NextResponse.json(expenseResponse(result.expense));
  } catch (error) {
    return apiErrorResponse(error, "Impossible d’ajouter le justificatif");
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }

  try {
    const result = await runAsAuthenticatedUser(async () => {
      const expense = await prisma.expense.findUnique({
        where: { id: parsedParams.data.id },
        select: { attachmentUrl: true },
      });

      return expense?.attachmentUrl ?? null;
    });

    if (result instanceof NextResponse) {
      return result;
    }

    if (!result) {
      return NextResponse.json(
        { error: "Justificatif introuvable" },
        { status: 404 },
      );
    }

    const blobResult = await get(result, { access: "private" });
    if (blobResult === null || blobResult.statusCode !== 200) {
      return NextResponse.json(
        { error: "Justificatif introuvable" },
        { status: 404 },
      );
    }

    return new NextResponse(blobResult.stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": inlineContentDisposition(result),
        "Content-Type": blobResult.blob.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "Impossible de télécharger le justificatif");
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
        const existingExpense = await prisma.expense.findUnique({
          where: { id: parsedParams.data.id },
          select: { id: true, attachmentUrl: true },
        });
        if (!existingExpense) {
          return { status: "not_found" as const };
        }

        if (existingExpense.attachmentUrl) {
          await del(existingExpense.attachmentUrl).catch(() => {});
        }

        const expense = await prisma.expense.update({
          where: { id: existingExpense.id },
          data: { attachmentUrl: null },
          select: expenseSelect,
        });

        return { status: "updated" as const, expense };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Frais introuvable" }, { status: 404 });
    }

    return NextResponse.json(expenseResponse(result.expense));
  } catch (error) {
    return apiErrorResponse(error, "Impossible de supprimer le justificatif");
  }
}
