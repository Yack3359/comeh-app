"use client";

import { Fragment, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/components/budget/utils";
import { roundAmount } from "@/lib/budget-amount";
import { clubIncomeFollowUpLabels, countLabel, monthLabel } from "@/lib/budget-pilotage-labels";
import type { ClubIncomeLine, ClubIncomeState } from "@/lib/budget-club-income";
import { ErrorMessage, FieldSelect, Popup, pilotageRequest } from "./shared";
import type { PilotageData } from "./types";

const stateLabels: Record<ClubIncomeState, string> = { COLLECTED: "Encaissé", PARTIAL: "Partiel", PENDING: "À encaisser" };
const stateStyles: Record<ClubIncomeState, string> = {
  COLLECTED: "border-emerald-200 bg-emerald-50 text-emerald-700", PARTIAL: "border-amber-200 bg-amber-50 text-amber-700", PENDING: "border-slate-200 bg-slate-100 text-slate-600",
};
export function PilotageClubIncome({ data, canManage, onChanged }: { data: PilotageData; canManage: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState<ClubIncomeLine | null>(null);
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);
  const { lines, posts, totals } = data.clubIncome;
  const filtered = lines.filter(line => !onlyOutstanding || line.outstanding > 0.5);
  const percent = totals.expected ? (100 * totals.collected / totals.expected).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " % de l’attendu" : "—";
  const indicators = [
    { label: "Attendu des clubs", value: totals.expected, detail: countLabel(totals.count, "action", "actions") },
    { label: "Encaissé", value: totals.collected, detail: percent },
    { label: "Annulé", value: totals.waived },
    { label: "Reste à encaisser", value: totals.outstanding },
    { label: "Dont en retard", value: totals.overdue },
  ];
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{indicators.map((item, index) => <Card key={item.label} className={"shadow-institutional " + (index === 4 && item.value > 0 ? "border-accent text-accent" : "")}>
      <CardContent className="p-4"><p className="text-sm font-semibold">{item.label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatCurrency(item.value)}</p>{item.detail && <p className="mt-1 text-xs">{item.detail}</p>}</CardContent>
    </Card>)}</div>
    <Card className="shadow-institutional"><CardContent className="space-y-4 p-5">
      <label data-print-hide className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyOutstanding} onChange={event => setOnlyOutstanding(event.target.checked)} />Seulement ce qui reste à encaisser</label>
      <div className="max-w-full overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Mois</TableHead><TableHead>Attendu</TableHead><TableHead>Encaissé</TableHead><TableHead>Annulé</TableHead><TableHead>Reste à encaisser</TableHead><TableHead>État</TableHead>{canManage && <TableHead data-print-hide>Suivi</TableHead>}</TableRow></TableHeader><TableBody>
        {posts.map(post => {
          const items = filtered.filter(line => line.postCode === post.code);
          if (!items.length) return null;
          return <Fragment key={post.code}><TableRow className="bg-primary-50 hover:bg-primary-50"><TableCell colSpan={canManage ? 8 : 7}>
            <p className="font-bold text-primary">{post.code} — {post.label}</p><p className="mt-1 text-xs text-slate-600">Total du poste : attendu {formatCurrency(post.expected)} · encaissé {formatCurrency(post.collected)} · annulé {formatCurrency(post.waived)} · reste à encaisser {formatCurrency(post.outstanding)}</p>
          </TableCell></TableRow>
            {items.map(line => <TableRow key={line.id}>
              <TableCell className="min-w-56 font-semibold">{line.label}{line.note && <p className="text-xs italic text-slate-500">{line.note}</p>}</TableCell><TableCell>{monthLabel(line.plannedMonth)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(line.expected)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(line.collected)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(line.waived)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(line.outstanding)}</TableCell>
              <TableCell><div className="flex flex-wrap gap-1"><Badge variant="outline" className={stateStyles[line.state]}>{line.state === "COLLECTED" && line.waived > 0.5 ? "Soldé" : stateLabels[line.state]}</Badge>{line.followUp && line.followUp in clubIncomeFollowUpLabels && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{clubIncomeFollowUpLabels[line.followUp as keyof typeof clubIncomeFollowUpLabels]}</Badge>}{line.overdue && <Badge variant="outline" className="border-accent/20 bg-accent-50 text-accent-700">En retard</Badge>}</div></TableCell>
              {canManage && <TableCell data-print-hide><Button size="sm" variant="outline" onClick={() => setEditing(line)}>Suivre / annuler</Button></TableCell>}
            </TableRow>)}
          </Fragment>;
        })}
        {!filtered.length && <TableRow><TableCell colSpan={canManage ? 8 : 7} className="py-8 text-center text-slate-500">{lines.length ? "Tout est soldé." : "Aucune recette club prévue pour " + data.fiscalYear.label + "."}</TableCell></TableRow>}
        {!!filtered.length && <TableRow className="font-bold"><TableCell colSpan={2}>Total</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(totals.expected)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(totals.collected)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(totals.waived)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(totals.outstanding)}</TableCell><TableCell />{canManage && <TableCell data-print-hide />}</TableRow>}
      </TableBody></Table></div>
      <p className="text-xs text-slate-500">Attendu : recettes clubs du budget révisé. Encaissé : recettes réalisées de la dernière matrice importée. Une recette est en retard quand le mois de l’action est passé. Une recette annulée n’est plus à encaisser ; le budget et l’atterrissage ne changent pas.</p>
    </CardContent></Card>
    {editing && <ClubIncomeForm line={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
  </div>;
}

function ClubIncomeForm({ line, onClose, onSaved }: { line: ClubIncomeLine; onClose: () => void; onSaved: () => void }) {
  const [followUp, setFollowUp] = useState(line.followUp ?? "none");
  const [waived, setWaived] = useState(String(roundAmount(line.waived)));
  const [note, setNote] = useState(line.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ceiling = roundAmount(Math.max(line.expected - line.collected, 0));
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      await pilotageRequest("/api/budget-actions/" + encodeURIComponent(line.id), { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubIncomeWaived: Number(waived), clubIncomeFollowUp: followUp === "none" ? null : followUp, clubIncomeNote: note.trim() || null }) });
      onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Impossible d’enregistrer le suivi de la recette"); }
    finally { setBusy(false); }
  }
  return <Popup title="Suivre / annuler une recette" busy={busy} onClose={onClose}>
    <div className="space-y-5"><ErrorMessage message={error} />
      <div><p className="font-semibold">{line.label}</p><p className="mt-1 text-sm text-slate-600">Attendu : {formatCurrency(line.expected)} · encaissé : {formatCurrency(line.collected)} · reste à encaisser : {formatCurrency(line.outstanding)}</p></div>
      <form onSubmit={submit} className="space-y-5"><fieldset disabled={busy} className="space-y-5">
        <FieldSelect id="income-follow-up" label="Suivi" value={followUp} onChange={setFollowUp} options={[{ value: "none", label: "Aucun suivi" }, ...Object.entries(clubIncomeFollowUpLabels).map(([value, label]) => ({ value, label }))]} />
        <div className="space-y-1.5"><Label htmlFor="income-waived">Montant annulé (€)</Label><Input id="income-waived" type="number" min="0" max={ceiling} step="0.01" required value={waived} onChange={event => setWaived(event.target.value)} />
          <Button type="button" size="sm" variant="outline" onClick={() => setWaived(String(ceiling))}>Annuler tout le reste</Button></div>
        <div className="space-y-1.5"><Label htmlFor="income-note">Explication{Number(waived) > 0 ? " (obligatoire)" : ""}</Label><textarea id="income-note" rows={4} maxLength={500} required={Number(waived) > 0} value={note} onChange={event => setNote(event.target.value)} className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-primary" /></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Fermer</Button><Button type="submit">{busy ? "Enregistrement…" : "Enregistrer"}</Button></div>
      </fieldset></form>
    </div>
  </Popup>;
}
