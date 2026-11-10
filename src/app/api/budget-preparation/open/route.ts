import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { buildPreparationLines } from "@/lib/budget-preparation";
import { serializeBudgetAction } from "@/lib/budget-pilotage-data";
import { preparationOpenSchema } from "@/lib/budget-preparation-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const body = preparationOpenSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return invalidDataResponse(body.error);
  try {
    return await runAsAuthenticatedUser(async () => prisma.$transaction(async tx => {
      const { fiscalYearLabel: label, copyFromPrevious } = body.data;
      const current = await tx.fiscalYear.findUnique({ where: { label }, include: { _count: { select: { budgetPosts: true, budgetSnapshots: true } } } });
      if (current && (current._count.budgetPosts || current._count.budgetSnapshots)) return NextResponse.json({ error: "Cet exercice possède déjà une trame ou un import" }, { status: 409 });
      const previous = await tx.fiscalYear.findUnique({ where: { label: String(Number(label) - 1) }, include: { budgetPosts: { include: { actions: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] } } });
      if (!previous?.budgetPosts.length) return NextResponse.json({ error: "Aucun poste disponible sur l’exercice précédent" }, { status: 409 });
      const preparationDeadline = current?.preparationDeadline ?? new Date((Number(label) - 1) + "-12-15T00:00:00.000Z");
      const year = await tx.fiscalYear.upsert({ where: { label }, update: { phase: "PREPARATION", preparationDeadline },
        create: { label, phase: "PREPARATION", preparationDeadline, startDate: new Date(label + "-01-01T00:00:00.000Z"), endDate: new Date(label + "-12-31T00:00:00.000Z") } });
      const template = buildPreparationLines(previous.budgetPosts.map(post => ({ ...post, fiscalYearLabel: previous.label })), previous.budgetPosts.flatMap(post => post.actions.map(serializeBudgetAction)));
      for (const post of template.posts) {
        const created = await tx.budgetPost.create({ data: { ...post, fiscalYearId: year.id } });
        if (copyFromPrevious) for (const { postCode: _code, ...line } of template.lines.filter(line => line.postCode === post.code)) {
          await tx.budgetAction.create({ data: { ...line,
            postId: created.id, origin: "RENEWED", status: "OPTION", includedInBudget: false, initialGross: 0, initialClubIncome: 0, initialFederation: 0 } });
        }
      }
      return NextResponse.json({ success: true, fiscalYearLabel: label }, { status: 201 });
    }, { isolationLevel: "Serializable" }), writeRoles);
  } catch (error) { return apiErrorResponse(error, "Impossible d’ouvrir la préparation du budget"); }
}
