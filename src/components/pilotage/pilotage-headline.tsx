import { formatCurrency } from "@/components/budget/utils";
import type { PilotageData } from "./types";

export function PilotageHeadline({ data }: { data: Pick<PilotageData, "headline" | "summary"> }) {
  const { actual, remaining, budget, landing } = data.summary.totals;
  const scale = Math.max(actual, landing, budget, 0);
  const width = (value: number) => scale ? Math.max(0, Math.min(100, value / scale * 100)) : 0;
  return <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50 p-5">
    <p className="text-sm leading-7 text-primary">{data.headline}</p>
    <div className="relative h-4 rounded bg-white" role="img" aria-label={"Réalisé " + formatCurrency(actual) + ", reste à venir " + formatCurrency(remaining) + ", budget " + formatCurrency(budget)}>
      <div className="absolute inset-y-0 left-0 rounded-l bg-primary" style={{ width: width(actual) + "%" }} />
      <div className="absolute inset-y-0 bg-primary/25" style={{ left: width(actual) + "%", width: Math.max(0, width(landing) - width(actual)) + "%" }} />
      <div className="absolute -top-1 h-6 w-0.5 bg-slate-900" style={{ left: "calc(" + width(budget) + "% - 1px)" }} />
    </div><p className="text-xs text-slate-600">Plein : réalisé · Clair : reste à venir · Trait : budget FFE</p>
  </div>;
}
