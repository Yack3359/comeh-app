import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { buildPilotageWorkbook } from "@/lib/budget-pilotage-export";
import { loadPilotage } from "@/lib/budget-pilotage-query";
import { pilotageQuerySchema } from "@/lib/budget-pilotage-validations";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const query = pilotageQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return invalidDataResponse(query.error);
  try {
    return await runAsAuthenticatedUser(async () => {
      const label = query.data.fiscalYear ?? String(new Date().getFullYear());
      const data = await loadPilotage(label);
      if (!data) return NextResponse.json({ error: "Exercice " + label + " introuvable" }, { status: 404 });
      const buffer = await buildPilotageWorkbook(data).xlsx.writeBuffer();
      return new NextResponse(new Uint8Array(buffer), { headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="pilotage-' + label + '-' + data.asOfDate.toISOString().slice(0, 10) + '.xlsx"',
        "Cache-Control": "no-store",
      } });
    });
  } catch (error) { return apiErrorResponse(error, "Impossible d’exporter le pilotage budgétaire"); }
}
