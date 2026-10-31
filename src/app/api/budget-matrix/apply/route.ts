import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { applyBudgetMatrix } from "@/lib/budget-matrix-apply";
import { matchMatrixActions, MatrixMatchError } from "@/lib/budget-matrix-diff";
import { readMatrixUpload, MatrixUploadError } from "@/lib/budget-matrix-upload";
import { existingMatrixAction } from "@/lib/budget-pilotage-data";
import { matrixApplySchema } from "@/lib/budget-pilotage-validations";
import { uploadBudgetMatrixFile } from "@/lib/import-storage";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    return await runAsAuthenticatedUser(async userId => {
      const { form, file, buffer, parsed } = await readMatrixUpload(request);
      let payload: unknown;
      try { payload = JSON.parse(String(form.get("payload"))); } catch { payload = null; }
      const fields = matrixApplySchema.safeParse(payload);
      if (!fields.success) return invalidDataResponse(fields.error);
      const fiscalYear = await prisma.fiscalYear.findUnique({ where: { label: fields.data.fiscalYearLabel } });
      if (!fiscalYear) return NextResponse.json({ error: "Exercice " + fields.data.fiscalYearLabel + " introuvable" }, { status: 400 });
      // Reject invalid overrides before uploading; validate again inside the transaction.
      const existing = await prisma.budgetAction.findMany({ where: { post: { fiscalYearId: fiscalYear.id } }, include: { post: true } });
      matchMatrixActions(parsed.actions, existing.map(existingMatrixAction), fields.data.overrides);
      const fileUrl = await uploadBudgetMatrixFile(buffer, file.name);
      return NextResponse.json(await applyBudgetMatrix({
        parsed, fiscalYearId: fiscalYear.id, asOfDate: fields.data.asOfDate,
        overrides: fields.data.overrides, userId, fileName: file.name, fileUrl,
      }));
    }, writeRoles);
  } catch (error) {
    if (error instanceof MatrixUploadError || error instanceof MatrixMatchError) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiErrorResponse(error, "Impossible d’importer la matrice budgétaire");
  }
}
