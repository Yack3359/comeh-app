"use client";

import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/components/budget/utils";
import { ErrorMessage, pilotageRequest } from "@/components/pilotage/shared";
import { countLabel, monthLabel, proposalLabels, teamLabels } from "@/lib/budget-pilotage-labels";
import { seasonLabelsOf } from "@/lib/budget-season";
import type { loadSeasonView } from "@/lib/budget-season-query";

type SeasonData = Awaited<ReturnType<typeof loadSeasonView>>;
const stateLabels = { PREPARATION: "en préparation", EXECUTION: "voté", MISSING: "pas encore ouvert" };
export function SeasonConstruction({ fiscalYearLabel, includePending }: { fiscalYearLabel: string; includePending: boolean }) {
  const labels = seasonLabelsOf(fiscalYearLabel);
  const [selected, setSelected] = useState<"END" | "START">("END");
  const season = labels[selected];
  const [data, setData] = useState<SeasonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [expanded, setExpanded] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setData(null); setExpanded([]);
    void pilotageRequest<SeasonData>("/api/budget-season?season=" + encodeURIComponent(season), { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Impossible de charger la saison"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [season, version]);
  const view = includePending ? data?.high : data?.retained;
  const amount = (part: "START" | "END", value: number) => view?.parts[part].state === "MISSING" ? "—" : formatCurrency(value);
  const cells = (item: SeasonData["retained"]["totals"]) => <>
    <TableCell className="whitespace-nowrap tabular-nums">{amount("START", item.START.federation)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{amount("END", item.END.federation)}</TableCell>
    <TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(item.total.gross)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(item.total.clubIncome)}</TableCell>
    <TableCell className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(item.total.federation)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(item.total.actual)}</TableCell>
  </>;
  return <div className="space-y-5" aria-busy={loading}>
    <div className="flex flex-wrap gap-2" aria-label="Saison sportive">{(["END", "START"] as const).map(part => <Button key={part} variant={selected === part ? "default" : "outline"} aria-pressed={selected === part} onClick={() => setSelected(part)}>Saison {labels[part]}</Button>)}</div>
    <ErrorMessage message={error} />{error && <Button variant="outline" onClick={() => setVersion(value => value + 1)}>Réessayer</Button>}
    {loading && <p role="status" className="text-slate-500">Chargement de la saison…</p>}
    {view && view.season === season && !loading && !error && <>
      <p className="text-sm text-slate-600">La saison {view.season} réunit septembre à décembre {view.parts.START.fiscalYearLabel} (budget {view.parts.START.fiscalYearLabel}, {stateLabels[view.parts.START.state]}) et janvier à août {view.parts.END.fiscalYearLabel} (budget {view.parts.END.fiscalYearLabel}, {stateLabels[view.parts.END.state]}).</p>
      <div className="grid gap-4 sm:grid-cols-3">{[
        { label: "Part FFE du début de saison", value: amount("START", view.totals.START.federation) },
        { label: "Part FFE de la fin de saison", value: amount("END", view.totals.END.federation) },
        { label: "Total FFE de la saison", value: formatCurrency(view.totals.total.federation) },
      ].map(item => <Card key={item.label}><CardContent className="p-4"><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-2xl font-bold text-primary">{item.value}</p></CardContent></Card>)}</div>
      <Table><TableHeader><TableRow><TableHead>Poste / ligne</TableHead><TableHead>Part FFE {view.parts.START.period}</TableHead><TableHead>Part FFE {view.parts.END.period}</TableHead>
        <TableHead>Coût total</TableHead><TableHead>− Clubs et tireurs</TableHead><TableHead>= Part FFE</TableHead><TableHead>Réalisé FFE</TableHead>
      </TableRow></TableHeader><TableBody>{view.posts.map(post => <Fragment key={post.code}>
        <TableRow className="bg-primary-50"><TableCell><Button variant="ghost" className="h-auto whitespace-normal text-left" aria-expanded={expanded.includes(post.code)} onClick={() => setExpanded(current => current.includes(post.code) ? current.filter(code => code !== post.code) : [...current, post.code])}>
          {expanded.includes(post.code) ? "−" : "+"} {post.code} — {post.label}</Button></TableCell>{cells(post)}</TableRow>
        {expanded.includes(post.code) && post.lines.map(line => <TableRow key={line.fiscalYearLabel + ":" + line.id}><TableCell className="min-w-56 pl-8">{line.label}
          <p className="text-xs text-slate-500">{monthLabel(line.plannedMonth)} {line.fiscalYearLabel} · {teamLabels[line.team]}{line.decision && " · " + proposalLabels[line.decision]}</p></TableCell>
          <TableCell className="whitespace-nowrap tabular-nums">{amount("START", line.part === "START" ? line.federation : 0)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{amount("END", line.part === "END" ? line.federation : 0)}</TableCell>
          {[line.gross, line.clubIncome, line.federation, line.actualFederation ?? 0].map((value, index) => <TableCell key={index} className="whitespace-nowrap tabular-nums">{formatCurrency(value)}</TableCell>)}
        </TableRow>)}
        {expanded.includes(post.code) && !post.lines.length && <TableRow><TableCell colSpan={7} className="text-slate-500">Aucune ligne retenue dans cette hypothèse.</TableCell></TableRow>}
      </Fragment>)}<TableRow className="bg-primary-50 font-bold"><TableCell>Total</TableCell>{cells(view.totals)}</TableRow></TableBody></Table>
      <h3 className="font-bold text-primary">Par équipe</h3>
      <Table><TableHeader><TableRow><TableHead>Équipe</TableHead><TableHead>Part FFE {view.parts.START.period}</TableHead><TableHead>Part FFE {view.parts.END.period}</TableHead><TableHead>Total FFE de la saison</TableHead></TableRow></TableHeader>
        <TableBody>{view.teams.map(item => <TableRow key={item.team}><TableCell>{teamLabels[item.team]}</TableCell><TableCell>{amount("START", item.START.federation)}</TableCell><TableCell>{amount("END", item.END.federation)}</TableCell><TableCell>{formatCurrency(item.total.federation)}</TableCell></TableRow>)}</TableBody></Table>
      {view.undated.filter(item => item.count > 0).map(item => <p key={item.fiscalYearLabel} className="text-sm text-slate-600">{countLabel(item.count, "ligne", "lignes")} du budget {item.fiscalYearLabel} {item.count > 1 ? "n’ont" : "n’a"} pas de mois (frais annuels ou lignes à préciser) : {item.count > 1 ? "elles ne sont rattachées à aucune saison et restent visibles" : "elle n’est rattachée à aucune saison et reste visible"} dans la lecture par année civile.</p>)}
    </>}
  </div>;
}
