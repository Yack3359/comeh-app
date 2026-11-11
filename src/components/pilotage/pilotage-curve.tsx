"use client";

import { useId, useState } from "react";
import { formatCurrency, formatDate } from "@/components/budget/utils";
import { monthLabel } from "@/lib/budget-pilotage-labels";
import type { buildCurve } from "@/lib/budget-analysis";

const colors = { budget: "#64748b", landing: "#eb6834", actual: "#0050A4" };
export function PilotageCurve({ points, asOfDate }: { points: ReturnType<typeof buildCurve>; asOfDate: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const tooltipId = useId();
  const active = hovered ?? focused;
  const selected = points.find(point => point.month === active);
  const last = points[points.length - 1];
  const actualPoints = points.filter((point): point is typeof point & { actual: number } => point.actual !== null);
  const known = actualPoints[actualPoints.length - 1];
  const largest = Math.max(0, ...points.flatMap(point => [point.budget, point.landing, point.actual ?? 0]));
  const step = [1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000].find(step => largest / step <= 6) ?? 1000000;
  const maximum = Math.max(step, Math.ceil(largest / step) * step);
  const x = (month: number) => 64 + (month - 1) * 640 / 11;
  const y = (amount: number) => 268 - amount / maximum * 252;
  const series = (key: "budget" | "landing" | "actual") => points.filter(point => point[key] !== null).map(point => x(point.month) + "," + y(point[key]!)).join(" ");
  const actualLabel = known ? "Réalisé fédé à fin " + monthLabel(known.month) : "Réalisé fédé";
  const legend = [{ key: "budget" as const, label: "Budget FFE", value: last?.budget ?? 0 },
    { key: "landing" as const, label: "Atterrissage", value: last?.landing ?? 0 }, { key: "actual" as const, label: actualLabel, value: known?.actual ?? null }];
  const description = "Budget total : " + formatCurrency(last?.budget ?? 0) + ". Atterrissage total : " + formatCurrency(last?.landing ?? 0) + ". " +
    (known ? actualLabel + " : " + formatCurrency(known.actual) + "." : "Aucun réalisé connu pour cet exercice.");
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700" title={"Situation au " + formatDate(asOfDate)}>
      {legend.map(item => <span key={item.key} className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-block w-6 border-t-2" style={{ borderColor: colors[item.key], borderStyle: item.key === "budget" ? "dashed" : "solid" }} />{item.label} <span className="whitespace-nowrap tabular-nums">{item.value === null ? "—" : formatCurrency(item.value)}</span></span>)}
    </div>
    <div className="relative">
      {selected && <div id={tooltipId} role="tooltip" className="pointer-events-none absolute top-2 z-10 rounded-lg border bg-white p-2 text-xs text-slate-700 shadow-sm" style={{ left: x(selected.month) / 720 * 100 + "%", marginLeft: selected.month <= 6 ? 8 : undefined, transform: selected.month >= 7 ? "translateX(calc(-100% - 8px))" : undefined }}>
        <p className="mb-1 font-semibold">Cumul à fin {monthLabel(selected.month)}</p>
        {([{ key: "budget", label: "Budget FFE" }, { key: "actual", label: "Réalisé fédé" }, { key: "landing", label: "Atterrissage" }] as const).map(item => <p key={item.key} className="flex items-center gap-2 whitespace-nowrap"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors[item.key] }} />{item.label} : <span className="tabular-nums">{selected[item.key] === null ? "—" : formatCurrency(selected[item.key]!)}</span></p>)}
      </div>}
      <svg viewBox="0 0 720 300" className="h-auto w-full" role="img" aria-label={description}>
        {Array.from({ length: maximum / step }, (_, index) => { const value = (index + 1) * step; return <g key={index}><line x1={64} x2={704} y1={y(value)} y2={y(value)} stroke="#e2e8f0" strokeWidth={1} />
          <text x={56} y={y(value) + 4} textAnchor="end" fill="#64748b" fontSize={11}>{(value / 1000).toLocaleString("fr-FR")} k€</text></g>; })}
        <line x1={64} x2={64} y1={16} y2={268} stroke="#e2e8f0" strokeWidth={1} />
        <text x={56} y={272} textAnchor="end" fill="#64748b" fontSize={11}>0 k€</text>
        {points.map(point => <text key={point.month} x={x(point.month)} y={290} textAnchor="middle" fill="#64748b" fontSize={11}>{monthLabel(point.month)}</text>)}
        <polyline points={series("budget")} fill="none" stroke={colors.budget} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6 4" />
        <polyline points={series("landing")} fill="none" stroke={colors.landing} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={series("actual")} fill="none" stroke={colors.actual} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {known && <circle cx={x(known.month)} cy={y(known.actual)} r={4} fill={colors.actual} stroke="#fff" strokeWidth={2} />}
        {selected && <line x1={x(selected.month)} x2={x(selected.month)} y1={16} y2={268} stroke="#94a3b8" strokeWidth={1} />}
        {points.map(point => <rect key={point.month} x={Math.max(64, x(point.month) - 320 / 11)} y={16} width={point.month === 1 || point.month === 12 ? 320 / 11 : 640 / 11} height={252} fill="transparent" tabIndex={0}
          aria-label={"Cumul à fin " + monthLabel(point.month)} aria-describedby={selected?.month === point.month ? tooltipId : undefined}
          onMouseEnter={() => setHovered(point.month)} onMouseLeave={() => setHovered(null)} onFocus={() => setFocused(point.month)} onBlur={() => setFocused(null)} />)}
      </svg>
    </div>
    <p className="text-xs text-slate-500">Montants cumulés en part FFE. Les actions sans mois sont réparties sur l’année.</p>
  </div>;
}
