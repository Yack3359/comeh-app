import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { loadPreparation, preparationYearLabel } from "@/lib/budget-preparation-query";
import { pilotageQuerySchema } from "@/lib/budget-pilotage-validations";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const query = pilotageQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return invalidDataResponse(query.error);
  try {
    return await runAsAuthenticatedUser(async () => {
      const label = await preparationYearLabel(query.data.fiscalYear);
      const data = await loadPreparation(label);
      if (!data) return NextResponse.json({ error: "Exercice " + label + " introuvable" }, { status: 404 });
      return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) { return apiErrorResponse(error, "Impossible de charger la préparation du budget"); }
}
