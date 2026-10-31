"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Copy, Download, Info, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/components/budget/utils";
import { ErrorMessage, FlagBadge, flagStyles } from "./shared";
import type { PilotageData } from "./types";

export function PilotageSummary({ data, onPost }: { data: PilotageData; onPost: (code: string) => void }) {
  const { summary } = data;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const percent = summary.totals.budget ? (100 * summary.totals.actual / summary.totals.budget).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " % du budget" : "Budget nul";
  const indicators = [
    { label: "Budget FFE", value: summary.totals.budget, detail: "dont " + formatCurrency(summary.totals.adjustments) + " de rallonges / ajustements" },
    { label: "Réalisé à date", value: summary.totals.actual, detail: percent },
    { label: "Reste à dépenser", value: summary.totals.remaining },
    { label: "Atterrissage estimé", value: summary.totals.landing },
    { label: "Marge globale", value: summary.globalMargin, detail: "Après restitution fédé de " + formatCurrency(summary.restitution) },
  ];
  async function copy() {
    setError(null);
    try { await navigator.clipboard.writeText(data.reportText); setCopied(true); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 2000); }
    catch { setError("Impossible de copier automatiquement. Sélectionnez le texte ci-dessous pour le copier."); }
  }
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{indicators.map((item, index) => <Card key={item.label} className={"shadow-institutional " + flagStyles[index === 4 && item.value < 0 ? "red" : summary.flag]}>
      <CardContent className="p-4"><p className="text-sm font-semibold">{item.label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatCurrency(item.value)}</p>{item.detail && <p className="mt-1 text-xs">{item.detail}</p>}</CardContent>
    </Card>)}</div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{summary.posts.map(post => {
      const scale = Math.max(post.budget, post.landing, 0);
      const width = (amount: number) => scale ? Math.max(0, Math.min(100, amount / scale * 100)) : 0;
      return <Card key={post.code} className="overflow-hidden shadow-institutional transition hover:border-primary">
        <button type="button" onClick={() => onPost(post.code)} className="w-full space-y-4 p-5 text-left focus-visible:outline-primary" aria-label={"Voir les actions du poste " + post.code + " — " + post.label}>
          <h2 className="font-bold text-primary">{post.code} — {post.label}</h2><FlagBadge flag={post.flag} />
          <dl className="grid grid-cols-2 gap-3 text-sm">{[
            ["Budget FFE", post.budget], ["Réalisé", post.actual], ["Atterrissage", post.landing], ["Marge", post.margin],
          ].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="font-semibold tabular-nums">{formatCurrency(value)}</dd></div>)}</dl>
          <div className="space-y-2"><div className="relative h-4 rounded bg-slate-100" role="img" aria-label={"Réalisé " + formatCurrency(post.actual) + ", atterrissage " + formatCurrency(post.landing) + ", budget " + formatCurrency(post.budget)}>
            <div className="absolute inset-y-0 left-0 rounded-l bg-primary" style={{ width: width(post.actual) + "%" }} />
            <div className="absolute inset-y-0 bg-primary/25" style={{ left: width(post.actual) + "%", width: Math.max(0, width(post.landing) - width(post.actual)) + "%" }} />
            <div className="absolute -top-1 h-6 w-0.5 bg-slate-900" style={{ left: "calc(" + width(post.budget) + "% - 1px)" }} />
          </div><p className="text-xs text-slate-500">Plein : réalisé · Clair : à venir · Trait : budget</p></div>
        </button>
      </Card>;
    })}</div>
    <Card className="shadow-institutional"><CardHeader><CardTitle>Points de vigilance</CardTitle></CardHeader><CardContent className="space-y-5">
      {!data.vigilance.length && <p className="text-sm text-slate-500">Aucun point de vigilance.</p>}
      {summary.posts.map(post => { const points = data.vigilance.filter(point => point.postCode === post.code); return points.length ? <div key={post.code}>
        <h3 className="mb-2 font-semibold">{post.code} — {post.label}</h3><ul className="space-y-2">{points.map((point, index) => {
          const Icon = point.level === "red" ? AlertTriangle : point.level === "orange" ? AlertCircle : Info;
          return <li key={index} className={"flex items-start gap-2 rounded-lg border p-3 text-sm " + (point.level === "info" ? "border-blue-100 bg-blue-50 text-primary" : flagStyles[point.level])}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{point.message}</span>
          </li>;
        })}</ul>
      </div> : null; })}
    </CardContent></Card>
    <Card className="shadow-institutional"><CardHeader><CardTitle>Point budgétaire à copier</CardTitle></CardHeader><CardContent className="space-y-4">
      <div data-print-hide className="flex flex-wrap gap-2"><Button onClick={() => void copy()}><Copy className="mr-2 h-4 w-4" /><span aria-live="polite">{copied ? "Copié" : "Copier le texte"}</span></Button>
        <Button asChild variant="outline"><a href={"/api/pilotage/export?fiscalYear=" + encodeURIComponent(data.fiscalYear.label)} download><Download className="mr-2 h-4 w-4" />Exporter en Excel</a></Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimer / PDF</Button>
      </div><ErrorMessage message={error} /><div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-5 text-sm leading-7">{data.reportText}</div>
    </CardContent></Card>
  </div>;
}
