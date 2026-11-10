"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/components/budget/utils";
import { ErrorMessage, pilotageRequest } from "@/components/pilotage/shared";
import { countLabel, teamLabels } from "@/lib/budget-pilotage-labels";
import type { PreparationData } from "./types";

export function PreparationProgress({ data, canDecide, isAdmin, onTeam, onChanged }: {
  data: PreparationData; canDecide: boolean; isAdmin: boolean; onTeam: (team: string) => void; onChanged: () => void;
}) {
  const [target, setTarget] = useState(String(data.fiscalYear.targetFederation ?? ""));
  const [deadline, setDeadline] = useState(data.fiscalYear.preparationDeadline?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { progress, fiscalYear, previousYear } = data;
  const preparing = fiscalYear.phase === "PREPARATION";
  async function send(url: string, method: string, body: object) {
    setBusy(true); setError(null);
    try { await pilotageRequest(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); onChanged(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Impossible d’enregistrer la modification"); }
    finally { setBusy(false); }
  }
  function vote() {
    const pending = progress.pending + progress.arbitration;
    if (window.confirm("Voter le budget " + fiscalYear.label + " ? " + countLabel(progress.pending, "ligne à confirmer", "lignes à confirmer") + " et " + countLabel(progress.arbitration, "ligne à arbitrer", "lignes à arbitrer") + (pending ? (pending > 1 ? " resteront" : " restera") + " en option, hors budget." : ".") + " Les lignes retenues deviendront le budget initial.")) {
      void send("/api/budget-preparation/vote", "POST", { fiscalYearLabel: fiscalYear.label, keepPending: pending > 0 });
    }
  }
  return <div className="space-y-6"><ErrorMessage message={error} />
    <ol className="grid gap-3 md:grid-cols-5">{progress.steps.map((step, index) => <li key={step.key} aria-current={step.current ? "step" : undefined} className={"rounded-xl border p-4 " + (step.current ? "border-primary bg-blue-50" : step.done ? "border-emerald-200 bg-emerald-50" : "bg-slate-50")}>
      <p className="text-sm font-bold">{step.done ? "✓" : index + 1} {step.label}</p><p className="mt-2 text-xs text-slate-600">{step.detail}</p>
    </li>)}</ol>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
      { label: "Part FFE retenue", value: progress.amounts.retained }, { label: "Hypothèse haute FFE", value: progress.amounts.high },
      { label: "Enveloppe FFE visée", value: fiscalYear.targetFederation }, { label: "Budget " + (Number(fiscalYear.label) - 1), value: previousYear?.budget },
      { label: "Atterrissage " + (Number(fiscalYear.label) - 1), value: previousYear?.landing },
    ].map(item => <Card key={item.label}><CardContent className="p-4"><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-2xl font-bold text-primary">{item.value == null ? "—" : formatCurrency(item.value)}</p></CardContent></Card>)}</div>
    {canDecide && preparing && <form className="flex flex-wrap items-end gap-3 rounded-xl border p-4" onSubmit={event => { event.preventDefault(); void send("/api/fiscal-years/" + encodeURIComponent(fiscalYear.id), "PATCH", { targetFederation: target === "" ? null : Number(target), preparationDeadline: deadline || null }); }}>
      <div className="space-y-1.5"><Label htmlFor="preparation-target">Enveloppe FFE visée (€)</Label><Input id="preparation-target" disabled={busy} type="number" min="0" max="9999999999.99" step="0.01" value={target} onChange={event => setTarget(event.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="preparation-deadline">Échéance</Label><Input id="preparation-deadline" disabled={busy} type="date" value={deadline} onChange={event => setDeadline(event.target.value)} /></div>
      <Button disabled={busy} type="submit">Enregistrer l’enveloppe et l’échéance</Button>
    </form>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{progress.byTeam.map(team => <Card key={team.team}><button type="button" className="w-full space-y-4 p-5 text-left" onClick={() => onTeam(team.team)}>
      <h3 className="font-bold text-primary">{teamLabels[team.team]}</h3>
      {team.kinds.filter(kind => kind.kind !== "OTHER" || kind.total > 0).map(kind => <div key={kind.kind} className="space-y-2"><p className="text-sm font-semibold">{{ COMPETITION: "Compétitions", TRAINING_CAMP: "Stages", OPERATING: "Fonctionnement", OTHER: "Autres" }[kind.kind]}</p>
        <div className="flex h-3 overflow-hidden rounded bg-slate-100" role="img" aria-label={countLabel(kind.retained, "retenue", "retenues") + ", " + kind.pending + " à confirmer, " + kind.arbitration + " à arbitrer, " + countLabel(kind.rejected, "écartée", "écartées")}>
          <div className="bg-emerald-500" style={{ width: (kind.total ? kind.retained / kind.total * 100 : 0) + "%" }} /><div className="bg-slate-400" style={{ width: (kind.total ? kind.pending / kind.total * 100 : 0) + "%" }} /><div className="bg-amber-400" style={{ width: (kind.total ? kind.arbitration / kind.total * 100 : 0) + "%" }} />
        </div><p className="text-xs text-slate-600">{countLabel(kind.retained, "retenue", "retenues")} · {kind.pending} à confirmer · {kind.arbitration} à arbitrer · {countLabel(kind.rejected, "écartée", "écartées")}</p><p className="text-xs text-slate-600">{countLabel(kind.unpriced, "montant à chiffrer", "montants à chiffrer")}</p>
      </div>)}
    </button></Card>)}</div>
    <Card><CardContent className="space-y-3 p-5"><h3 className="font-bold text-primary">Ce qu’il reste à faire</h3>{progress.todo.length ? <ul className="space-y-2 text-sm">{progress.todo.map(item => <li key={item}>{item}</li>)}</ul> : <p className="text-sm text-slate-600">{preparing ? "Les propositions sont prêtes pour le vote." : "Le budget est voté."}</p>}</CardContent></Card>
    <div className="flex flex-wrap gap-3">{canDecide && <><Button asChild variant="outline"><a href={"/api/budget-preparation/export?fiscalYear=" + encodeURIComponent(fiscalYear.label)} download>Exporter en Excel</a></Button>
      {preparing && <Button disabled={busy} onClick={vote}>Voter le budget</Button>}</>}
      {isAdmin && !preparing && <Button disabled={busy} variant="outline" onClick={() => { if (window.confirm("Rouvrir la préparation du budget " + fiscalYear.label + " ? Les montants initiaux du vote seront remis à zéro.")) void send("/api/budget-preparation/reopen", "POST", { fiscalYearLabel: fiscalYear.label }); }}>Rouvrir la préparation</Button>}
    </div>
  </div>;
}
