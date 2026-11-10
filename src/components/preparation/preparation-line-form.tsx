"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/components/budget/utils";
import { ErrorMessage, FieldSelect, Popup, pilotageRequest } from "@/components/pilotage/shared";
import { categoryLabels, monthLabel, proposalLabels, teamLabels } from "@/lib/budget-pilotage-labels";
import type { PreparationData, PreparationLine } from "./types";

const roundAmount = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
type Category = keyof typeof categoryLabels;
export function PreparationLineForm({ line, posts, onClose, onSaved }: {
  line?: PreparationLine; posts: PreparationData["posts"]; onClose: () => void; onSaved: () => void;
}) {
  const [postId, setPostId] = useState(line?.postId ?? posts[0]?.id ?? "");
  const [label, setLabel] = useState(line?.label ?? "");
  const [categories, setCategories] = useState<Category[]>(line?.fencingCategories ?? []);
  const [month, setMonth] = useState(String(line?.plannedMonth ?? "none"));
  const [athletes, setAthletes] = useState(String(line?.athleteCount ?? ""));
  const [staff, setStaff] = useState(String(line?.staffCount ?? ""));
  const [days, setDays] = useState(String(line?.dayCount ?? ""));
  const [gross, setGross] = useState(String(line?.revisedGross ?? 0));
  const [federation, setFederation] = useState(String(line?.revisedFederation ?? 0));
  const [percent, setPercent] = useState(line?.revisedGross ? line.revisedFederation / line.revisedGross * 100 : 100);
  const [confirmed, setConfirmed] = useState(line?.amountsConfirmed ?? false);
  const [decision, setDecision] = useState(line?.proposalStatus ?? "PROPOSED");
  const [comment, setComment] = useState(line?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endpoint = "/api/budget-preparation/lines" + (line ? "/" + encodeURIComponent(line.id) : "");
  async function send(payload?: object, method = line ? "PATCH" : "POST") {
    setBusy(true); setError(null);
    try { await pilotageRequest(endpoint, { method, ...(payload ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {}) }); onSaved(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Impossible d’enregistrer la proposition"); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void send({ postId, label, fencingCategories: categories, plannedMonth: month === "none" ? null : Number(month),
      athleteCount: athletes === "" ? null : Number(athletes), staffCount: staff === "" ? null : Number(staff), dayCount: days === "" ? null : Number(days),
      revisedGross: Number(gross), revisedFederation: Number(federation), amountsConfirmed: confirmed, proposalStatus: decision, comment: comment || null });
  }
  return <Popup title={line ? "Modifier la proposition" : "Ajouter une compétition ou un stage"} onClose={onClose} busy={busy}>
    <ErrorMessage message={error} /><form onSubmit={submit} className="mt-4 space-y-5"><fieldset disabled={busy} className="space-y-5">
      <FieldSelect id="preparation-post" label="Rubrique" value={postId} onChange={setPostId} options={posts.map(post => ({ value: post.id, label: post.code + " — " + post.label }))} />
      <div className="space-y-1.5"><Label htmlFor="preparation-label">Libellé</Label><Input id="preparation-label" required maxLength={1000} value={label} onChange={event => setLabel(event.target.value)} /></div>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Équipe (catégories)</legend><p className="text-xs text-slate-500">Séniors : Sénior · M20 / U23 : M20 et U23 · M17 : M17, M15 et M13 · Plusieurs équipes ou aucune : Commun.</p>
        <div className="flex flex-wrap gap-4">{Object.entries(categoryLabels).map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categories.includes(value as Category)} onChange={event => setCategories(current => event.target.checked ? [...current, value as Category] : current.filter(category => category !== value))} />{label}</label>)}</div>
      </fieldset>
      <FieldSelect id="preparation-month" label="Mois prévu" value={month} onChange={setMonth} options={[{ value: "none", label: "Non précisé" }, ...Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: monthLabel(index + 1) }))]} />
      <div className="grid gap-4 sm:grid-cols-3">{[{ id: "athletes", label: "Tireurs", value: athletes, set: setAthletes }, { id: "staff", label: "Cadres", value: staff, set: setStaff }, { id: "days", label: "Jours", value: days, set: setDays }].map(field =>
        <div key={field.id} className="space-y-1.5"><Label htmlFor={field.id}>{field.label}</Label><Input id={field.id} type="number" min="0" max="999" step="1" value={field.value} onChange={event => field.set(event.target.value)} /></div>)}</div>
      {line?.source && <div className="space-y-3 rounded-lg bg-blue-50 p-4 text-sm"><p className="font-semibold">Référence {line.source.fiscalYearLabel} — {line.source.label} ({teamLabels[line.team]})</p>
        <p>Budget : {formatCurrency(line.source.revisedGross)} au total · {formatCurrency(line.source.revisedFederation)} FFE · {formatCurrency(line.source.revisedClubIncome)} clubs.</p>
        <p>Réalisé : {line.source.actualGross === null ? "—" : formatCurrency(line.source.actualGross)} au total · {line.source.actualFederation === null ? "—" : formatCurrency(line.source.actualFederation)} FFE · {line.source.actualClubIncome === null ? "—" : formatCurrency(line.source.actualClubIncome)} clubs.</p>
        {line.suggestion && <Button type="button" variant="outline" onClick={() => { const suggestion = line.suggestion!; setGross(String(suggestion.gross)); setFederation(String(suggestion.federation)); setPercent(suggestion.gross ? suggestion.federation / suggestion.gross * 100 : 100); }}>Reprendre {line.suggestion.basis}</Button>}
      </div>}
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="preparation-gross">Coût total estimé (€)</Label><Input id="preparation-gross" required type="number" min="0" max="9999999999.99" step="0.01" value={gross} onChange={event => { setGross(event.target.value); setFederation(String(roundAmount(Number(event.target.value) * percent / 100))); }} /></div>
        <div className="space-y-1.5"><Label htmlFor="preparation-federation">Part FFE (€)</Label><Input id="preparation-federation" required type="number" min="0" max={Number(gross)} step="0.01" value={federation} onChange={event => { setFederation(event.target.value); setPercent(Number(gross) ? Number(event.target.value) / Number(gross) * 100 : 0); }} /></div></div>
      <div className="space-y-2"><Label htmlFor="preparation-percent">Prise en charge FFE : {percent.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</Label><input id="preparation-percent" className="w-full accent-primary" type="range" min="0" max="100" step="5" value={percent} onChange={event => { const value = Number(event.target.value); setPercent(value); setFederation(String(roundAmount(Number(gross) * value / 100))); }} />
        <p className="text-sm text-slate-600">Reste à la charge des clubs / tireurs : {formatCurrency(roundAmount(Number(gross) - Number(federation)))}</p></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Montant chiffré</label>
      <FieldSelect id="preparation-decision" label="Décision" value={decision} onChange={value => setDecision(value as typeof decision)} options={Object.entries(proposalLabels).map(([value, label]) => ({ value, label }))} />
      <div className="space-y-1.5"><Label htmlFor="preparation-comment">Commentaire</Label><textarea id="preparation-comment" rows={4} maxLength={10000} value={comment} onChange={event => setComment(event.target.value)} className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-primary" /></div>
      <div className="flex flex-wrap justify-end gap-2">{line && <Button type="button" variant="destructive" onClick={() => { if (window.confirm("Supprimer définitivement « " + line.label + " » ?")) void send(undefined, "DELETE"); }}>Supprimer</Button>}
        <Button type="button" variant="outline" onClick={onClose}>Fermer</Button><Button type="submit">{busy ? "Enregistrement…" : "Enregistrer"}</Button></div>
    </fieldset></form>
  </Popup>;
}
