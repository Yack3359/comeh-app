import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { buildMatrixWorkbook } from "@/lib/budget-matrix-export";
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
      const buffer = await buildMatrixWorkbook({ fiscalYearLabel: data.fiscalYear.label, asOfDate: data.asOfDate,
        restitutionAmount: data.fiscalYear.restitutionAmount, posts: data.posts, actions: data.actions }).xlsx.writeBuffer();
      const date = data.asOfDate.toISOString().slice(2, 10).split("-").reverse().join(".");
      return new NextResponse(new Uint8Array(buffer), { headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Matrice EH ' + label + ' au ' + date + '.xlsx"',
        "Cache-Control": "no-store",
      } });
    });
  } catch (error) { return apiErrorResponse(error, "Impossible d’exporter la matrice FFE"); }
}
