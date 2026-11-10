import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/api-response";
import { seasonYears } from "@/lib/budget-season";
import { loadSeasonView } from "@/lib/budget-season-query";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const season = new URL(request.url).searchParams.get("season") ?? "";
  if (!seasonYears(season)) return NextResponse.json({ error: "Saison invalide" }, { status: 400 });
  try {
    return await runAsAuthenticatedUser(async () => NextResponse.json(await loadSeasonView(season), { headers: { "Cache-Control": "no-store" } }));
  } catch (error) { return apiErrorResponse(error, "Impossible de charger le budget de la saison"); }
}
