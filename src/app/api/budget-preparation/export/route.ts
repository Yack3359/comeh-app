import { NextResponse } from "next/server";
import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import { buildPreparationWorkbook } from "@/lib/budget-preparation-export";
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
      const buffer = await buildPreparationWorkbook(data).xlsx.writeBuffer();
      return new NextResponse(new Uint8Array(buffer), { headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="budget-' + label + '.xlsx"', "Cache-Control": "no-store",
      } });
    });
  } catch (error) { return apiErrorResponse(error, "Impossible d’exporter la préparation du budget"); }
}
