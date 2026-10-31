import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { computeActionFigures, computeFiscalYearSummary, listVigilancePoints } from "@/lib/budget-pilotage";
import { serializeBudgetAction } from "@/lib/budget-pilotage-data";
import { pilotageQuerySchema } from "@/lib/budget-pilotage-validations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const query = pilotageQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return invalidDataResponse(query.error);
  try {
    return await runAsAuthenticatedUser(async () => {
      const label = query.data.fiscalYear ?? String(new Date().getFullYear());
      const year = await prisma.fiscalYear.findUnique({ where: { label } });
      if (!year) return NextResponse.json({ error: "Exercice " + label + " introuvable" }, { status: 404 });
      const fiscalYear = { id: year.id, label: year.label, restitutionAmount: Number(year.restitutionAmount) };
      const [posts, rows, snapshots] = await Promise.all([
        prisma.budgetPost.findMany({ where: { fiscalYearId: year.id }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
        prisma.budgetAction.findMany({ where: { post: { fiscalYearId: year.id } }, include: { post: { select: { code: true } } }, orderBy: { sortOrder: "asc" } }),
        prisma.budgetSnapshot.findMany({ where: { fiscalYearId: year.id }, orderBy: [{ asOfDate: "desc" }, { createdAt: "desc" }],
          select: { id: true, asOfDate: true, sourceFileName: true, createdAt: true, importedBy: { select: { name: true } } } }),
      ]);
      const actions = rows.map(row => {
        const action = { ...serializeBudgetAction(row), postCode: row.post.code };
        return { ...action, figures: computeActionFigures(action) };
      });
      const summary = computeFiscalYearSummary({ fiscalYear, posts, actions });
      const asOfDate = snapshots[0]?.asOfDate ?? new Date();
      return NextResponse.json({ fiscalYear, posts, actions, summary, asOfDate,
        vigilance: listVigilancePoints(summary, actions, { asOfDate, fiscalYearLabel: year.label }), snapshots },
        { headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) { return apiErrorResponse(error, "Impossible de charger le pilotage budgétaire"); }
}
