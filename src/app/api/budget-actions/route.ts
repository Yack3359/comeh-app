import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { inferredSeasonLabel } from "@/lib/budget-matrix-apply";
import { serializeBudgetAction } from "@/lib/budget-pilotage-data";
import { budgetActionCreateSchema, includedInBudgetForStatus } from "@/lib/budget-pilotage-validations";
import { seasonYears } from "@/lib/budget-season";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const years = seasonYears(new URL(request.url).searchParams.get("season") ?? "");
  if (!years) return NextResponse.json({ error: "Saison invalide" }, { status: 400 });
  try {
    return await runAsAuthenticatedUser(async () => {
      const actions = await prisma.budgetAction.findMany({
        where: { post: { fiscalYear: { label: { in: [String(years.startYear), String(years.endYear)] }, phase: "EXECUTION" } } },
        select: { id: true, label: true, plannedMonth: true, competitionId: true, post: { select: { code: true, label: true, fiscalYear: { select: { label: true } } } } },
        orderBy: [{ post: { fiscalYear: { label: "asc" } } }, { post: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      });
      return NextResponse.json(actions.map(action => ({ id: action.id, label: action.label, postCode: action.post.code,
        postLabel: action.post.label, fiscalYearLabel: action.post.fiscalYear.label, plannedMonth: action.plannedMonth, competitionId: action.competitionId })),
      { headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) { return apiErrorResponse(error, "Impossible de charger les actions budgétaires"); }
}
export async function POST(request: Request) {
  const body = budgetActionCreateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return invalidDataResponse(body.error);
  try {
    return await runAsAuthenticatedUser(async () => {
      const post = await prisma.budgetPost.findUnique({ where: { id: body.data.postId }, include: { fiscalYear: true } });
      if (!post) return NextResponse.json({ error: "Poste budgétaire introuvable" }, { status: 400 });
      const { status, ...data } = body.data;
      const includedInBudget = includedInBudgetForStatus(status, true);
      const seasonLabel = inferredSeasonLabel(post.fiscalYear.label, data.plannedMonth ?? null);
      const season = seasonLabel ? await prisma.season.findUnique({ where: { label: seasonLabel }, select: { id: true } }) : null;
      const action = await prisma.budgetAction.create({ data: {
        ...data, status, includedInBudget, seasonId: season?.id ?? null,
        initialGross: includedInBudget ? data.revisedGross : 0,
        initialClubIncome: includedInBudget ? data.revisedClubIncome : 0,
        initialFederation: includedInBudget ? data.revisedFederation : 0,
      } });
      return NextResponse.json(serializeBudgetAction(action), { status: 201 });
    }, writeRoles);
  } catch (error) { return apiErrorResponse(error, "Impossible de créer l’action budgétaire"); }
}
