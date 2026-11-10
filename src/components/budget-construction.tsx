"use client";

import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/components/budget/utils";
import { proposalLabels } from "@/lib/budget-pilotage-labels";
import { SeasonConstruction } from "@/components/season-construction";
import { seasonPartTitle } from "@/lib/budget-season";
import type { buildConstruction } from "@/lib/budget-preparation";

type Construction = ReturnType<typeof buildConstruction>;
export function BudgetConstruction({ data, includePending, onIncludePending }: {
  data: Construction; includePending?: boolean; onIncludePending?: (value: boolean) => void;
}) {
  const [view, setView] = useState<"year" | "season">("year");
  const [expanded, setExpanded] = useState<string[]>([]);
  const amounts = (item: Construction["totals"]) => <>
    <TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(item.gross)}</TableCell>
    <TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(item.clubIncome)}</TableCell>
    <TableCell className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(item.federation)}</TableCell>
    <TableCell>{item.federationPercent.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</TableCell>
    <TableCell className="whitespace-nowrap">{formatCurrency(item.previousBudget)}</TableCell><TableCell className="whitespace-nowrap">{formatCurrency(item.previousActual)}</TableCell>
    <TableCell className="whitespace-nowrap">{formatCurrency(item.variance)}</TableCell>
    {data.phase === "EXECUTION" && <TableCell className="whitespace-nowrap">{formatCurrency(item.actual.federation)}</TableCell>}
  </>;
  return <Card className="shadow-institutional"><CardContent className="space-y-5 p-5">
    <p className="text-sm text-slate-600">Coût total − clubs et tireurs = part FFE. Les montants sont comparés à ceux de l’exercice précédent.</p>
    {onIncludePending && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includePending} onChange={event => onIncludePending(event.target.checked)} />Inclure les lignes pas encore retenues</label>}
    <div className="flex flex-wrap gap-2" aria-label="Lecture du budget">{[{ value: "year", label: "Par année civile " + data.fiscalYearLabel }, { value: "season", label: "Par saison sportive" }].map(item =>
      <Button key={item.value} variant={view === item.value ? "default" : "outline"} aria-pressed={view === item.value} onClick={() => setView(item.value as "year" | "season")}>{item.label}</Button>)}</div>
    {view === "season" ? <SeasonConstruction key={data.fiscalYearLabel} fiscalYearLabel={data.fiscalYearLabel} includePending={includePending ?? false} /> : <>
    <div className="grid gap-4 sm:grid-cols-2">{data.posts.map(post => <div key={post.id} className="space-y-2 rounded-lg border p-4">
      <p className="font-semibold text-primary">{post.code} — {post.label}</p>
      <div className="flex h-4 overflow-hidden rounded bg-slate-100" role="img" aria-label={"Part FFE " + formatCurrency(post.federation) + ", clubs et tireurs " + formatCurrency(post.clubIncome)}>
        <div className="bg-primary" style={{ width: Math.min(100, post.federationPercent) + "%" }} /><div className="bg-amber-300" style={{ width: (post.gross ? Math.min(100, post.clubIncome / post.gross * 100) : 0) + "%" }} />
      </div><p className="text-xs text-slate-600">Bleu : part FFE {formatCurrency(post.federation)} · Jaune : clubs et tireurs {formatCurrency(post.clubIncome)}</p>
    </div>)}</div>
    <Table><TableHeader><TableRow><TableHead>Poste / ligne</TableHead><TableHead>Coût total</TableHead><TableHead>− Clubs et tireurs</TableHead><TableHead>= Part FFE</TableHead>
      <TableHead>% FFE</TableHead><TableHead>Budget FFE N-1</TableHead><TableHead>Réalisé FFE N-1</TableHead><TableHead>Écart / budget N-1</TableHead>{data.phase === "EXECUTION" && <TableHead>Réalisé FFE de l’exercice</TableHead>}
    </TableRow></TableHeader><TableBody>{data.posts.map(post => <Fragment key={post.id}>
      <TableRow className="bg-primary-50"><TableCell><Button variant="ghost" className="h-auto whitespace-normal text-left" aria-expanded={expanded.includes(post.id)} onClick={() => setExpanded(current => current.includes(post.id) ? current.filter(id => id !== post.id) : [...current, post.id])}>
        {expanded.includes(post.id) ? "−" : "+"} {post.code} — {post.label}</Button></TableCell>{amounts(post)}</TableRow>
      {expanded.includes(post.id) && post.lines.map(line => <TableRow key={line.id}><TableCell className="min-w-56 pl-8">{line.label}{line.decision && <p className="text-xs text-slate-500">{proposalLabels[line.decision]}</p>}</TableCell>{amounts(line)}</TableRow>)}
      {expanded.includes(post.id) && !post.lines.length && <TableRow><TableCell colSpan={data.phase === "EXECUTION" ? 9 : 8} className="text-slate-500">Aucune ligne retenue dans cette hypothèse.</TableCell></TableRow>}
    </Fragment>)}<TableRow className="bg-primary-50 font-bold"><TableCell>Total</TableCell>{amounts(data.totals)}</TableRow></TableBody></Table>
    <h3 className="font-bold text-primary">Répartition par saison sportive</h3>
    <Table><TableHeader><TableRow><TableHead>Poste</TableHead>{(["END", "START", "NONE"] as const).map(part => <TableHead key={part}>{seasonPartTitle(part, data.fiscalYearLabel)}</TableHead>)}<TableHead>Total {data.fiscalYearLabel}</TableHead></TableRow></TableHeader>
      <TableBody>{[...data.posts, { ...data.totals, id: "total", code: "", label: "Total" }].map(post => <TableRow key={post.id} className={post.code ? "" : "bg-primary-50 font-bold"}><TableCell>{post.code ? post.code + " — " : ""}{post.label}</TableCell>
        {(["END", "START", "NONE"] as const).map(part => <TableCell key={part} className="whitespace-nowrap tabular-nums">{formatCurrency(post.seasonParts[part].federation)}</TableCell>)}<TableCell className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(post.federation)}</TableCell>
      </TableRow>)}</TableBody></Table>
    <p className="text-sm text-slate-600">Une saison sportive est à cheval sur deux budgets : cliquez sur “Par saison sportive” pour voir une saison complète.</p>
    </>}
  </CardContent></Card>;
}
