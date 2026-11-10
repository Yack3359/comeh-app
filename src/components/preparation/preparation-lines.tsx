"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/components/budget/utils";
import { ErrorMessage, pilotageRequest } from "@/components/pilotage/shared";
import { countLabel, monthLabel, proposalLabels, teamLabels } from "@/lib/budget-pilotage-labels";
import { PreparationLineForm } from "./preparation-line-form";
import type { PreparationData, PreparationLine } from "./types";

const decisionStyles = { PROPOSED: "bg-slate-100 text-slate-600", VALIDATED: "bg-emerald-50 text-emerald-700", ARBITRATION: "bg-amber-50 text-amber-700", REJECTED: "bg-accent-50 text-accent-700" };
export function PreparationLines({ data, canPrepare, team, onTeam, onChanged }: {
  data: PreparationData; canPrepare: boolean; team: string; onTeam: (team: string) => void; onChanged: () => void;
}) {
  const [editor, setEditor] = useState<{ line?: PreparationLine } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = canPrepare && data.fiscalYear.phase === "PREPARATION";
  const lines = data.lines.filter(line => team === "all" || line.team === team);
  async function patch(line: PreparationLine, update: object) {
    setBusy(true); setError(null);
    try { await pilotageRequest("/api/budget-preparation/lines/" + encodeURIComponent(line.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update) }); onChanged(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Impossible de modifier la proposition"); }
    finally { setBusy(false); }
  }
  const subtotal = (items: PreparationLine[]) => <><TableCell colSpan={2}>Total des propositions affichées</TableCell>{["revisedGross", "revisedClubIncome", "revisedFederation"].map(key => <TableCell key={key} className="whitespace-nowrap font-bold">{formatCurrency(items.reduce((total, line) => total + line[key as "revisedGross"], 0))}</TableCell>)}<TableCell colSpan={3} /></>;
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2" aria-label="Filtrer par équipe">{[{ value: "all", label: "Toutes les équipes" }, ...Object.entries(teamLabels).map(([value, label]) => ({ value, label }))].map(item =>
      <Button key={item.value} size="sm" variant={team === item.value ? "default" : "outline"} aria-pressed={team === item.value} onClick={() => onTeam(item.value)}>{item.label}</Button>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{countLabel(lines.length, "proposition", "propositions")} · montants en euros</p>
      {editable && <Button disabled={busy || !data.posts.length} onClick={() => setEditor({})}>Ajouter une compétition ou un stage</Button>}</div>
    <ErrorMessage message={error} />
    <Card className="shadow-institutional"><CardContent className="p-4"><Table><TableHeader><TableRow><TableHead>Ligne</TableHead><TableHead>Décision</TableHead>
      <TableHead>Coût total</TableHead><TableHead>Clubs / tireurs</TableHead><TableHead>Part FFE</TableHead><TableHead>% FFE</TableHead><TableHead>Référence {Number(data.fiscalYear.label) - 1}</TableHead><TableHead>Chiffré</TableHead>
    </TableRow></TableHeader><TableBody>{data.posts.map(post => {
      const items = lines.filter(line => line.postId === post.id);
      if (!items.length) return null;
      return <Fragment key={post.id}><TableRow className="bg-primary-50"><TableCell colSpan={8} className="font-bold text-primary">{post.code} — {post.label}</TableCell></TableRow>
        {items.map(line => <TableRow key={line.id} className={editable ? "cursor-pointer" : ""} onClick={editable && !busy ? () => setEditor({ line }) : undefined}>
          <TableCell className="min-w-60">{editable ? <button className="text-left font-semibold text-primary hover:underline" disabled={busy} onClick={event => { event.stopPropagation(); setEditor({ line }); }}>{line.label}</button> : <span className="font-semibold">{line.label}</span>}
            <p className="mt-1 text-xs text-slate-500">{monthLabel(line.plannedMonth)} · {teamLabels[line.team]} · {line.athleteCount === null ? "— tireurs" : countLabel(line.athleteCount, "tireur", "tireurs")} / {line.staffCount === null ? "— cadres" : countLabel(line.staffCount, "cadre", "cadres")} / {line.dayCount === null ? "— jours" : countLabel(line.dayCount, "jour", "jours")}</p>
            <p className="mt-1 text-xs text-slate-500">Proposé par {line.proposedByName ?? (line.source ? "reconduction de " + line.source.fiscalYearLabel : "—")}</p>{line.comment && <p className="mt-1 text-xs italic text-slate-500">{line.comment}</p>}
          </TableCell><TableCell><Badge variant="outline" className={decisionStyles[line.proposalStatus ?? "PROPOSED"]}>{proposalLabels[line.proposalStatus ?? "PROPOSED"]}</Badge>
            {editable && <div className="mt-2 flex flex-wrap gap-1" onClick={event => event.stopPropagation()}>{[["VALIDATED", "Retenir"], ["ARBITRATION", "À arbitrer"], ["REJECTED", "Écarter"]].map(([value, label]) =>
              <Button key={value} size="sm" variant="outline" disabled={busy || line.proposalStatus === value} onClick={() => void patch(line, { proposalStatus: value })}>{label}</Button>)}</div>}
          </TableCell>{[line.revisedGross, line.revisedClubIncome, line.revisedFederation].map((amount, index) => <TableCell key={index} className="whitespace-nowrap tabular-nums">{formatCurrency(amount)}{index === 0 && amount === 0 && !line.amountsConfirmed && <p className="text-xs text-slate-500">à chiffrer</p>}</TableCell>)}
          <TableCell>{line.revisedGross === 0 ? "—" : (100 * line.revisedFederation / line.revisedGross).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %"}</TableCell>
          <TableCell className="whitespace-nowrap text-xs">Budget FFE : {line.source ? formatCurrency(line.source.revisedFederation) : "—"}<p>Réalisé FFE : {line.source?.actualFederation == null ? "—" : formatCurrency(line.source.actualFederation)}</p></TableCell>
          <TableCell onClick={event => event.stopPropagation()}><input type="checkbox" aria-label={"Montant chiffré : " + line.label} checked={line.amountsConfirmed} disabled={!editable || busy} onChange={event => void patch(line, { amountsConfirmed: event.target.checked })} /></TableCell>
        </TableRow>)}<TableRow className="bg-slate-50">{subtotal(items)}</TableRow>
      </Fragment>;
    })}{!lines.length && <TableRow><TableCell colSpan={8} className="py-8 text-center text-slate-500">Aucune proposition pour cette équipe.</TableCell></TableRow>}
      <TableRow className="bg-primary-50 font-bold">{subtotal(lines)}</TableRow>
    </TableBody></Table></CardContent></Card>
    {editable && editor && <PreparationLineForm line={editor.line} posts={data.posts} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); onChanged(); }} />}
  </div>;
}
