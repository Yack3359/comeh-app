import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { buildMatrixDiff } from "@/lib/budget-matrix-diff";
import { readMatrixUpload, MatrixUploadError } from "@/lib/budget-matrix-upload";
import { existingMatrixAction } from "@/lib/budget-pilotage-data";
import { previewFieldsSchema, fiscalYearLabelSchema } from "@/lib/budget-pilotage-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    return await runAsAuthenticatedUser(async () => {
      const { form, parsed } = await readMatrixUpload(request);
      const fields = previewFieldsSchema.safeParse({ fiscalYearLabel: form.get("fiscalYearLabel") ?? undefined });
      if (!fields.success) return invalidDataResponse(fields.error);
      const label = fiscalYearLabelSchema.safeParse(fields.data.fiscalYearLabel ?? parsed.fiscalYearLabel);
      if (!label.success) return invalidDataResponse(label.error);
      const fiscalYear = await prisma.fiscalYear.findUnique({ where: { label: label.data }, select: { id: true, label: true } });
      if (!fiscalYear) return NextResponse.json({ error: "Exercice " + label.data + " introuvable" }, { status: 400 });
      const [actions, posts] = await Promise.all([
        prisma.budgetAction.findMany({ where: { post: { fiscalYearId: fiscalYear.id } }, include: { post: true } }),
        prisma.budgetPost.findMany({ where: { fiscalYearId: fiscalYear.id } }),
      ]);
      return NextResponse.json({ existingActions: actions.map(action => ({ id: action.id, postCode: action.post.code, label: action.label })), parsed, diff: buildMatrixDiff(parsed, actions.map(existingMatrixAction), undefined, posts), fiscalYear });
    }, writeRoles);
  } catch (error) {
    if (error instanceof MatrixUploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiErrorResponse(error, "Impossible de préparer l’aperçu de la matrice");
  }
}
