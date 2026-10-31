"use client";

import { useState, type FormEvent } from "react";
import type { BudgetActionStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { categoryLabels, monthLabel, statusLabels } from "@/lib/budget-pilotage-labels";
import { ErrorMessage, FieldSelect, Popup, pilotageRequest } from "./shared";
import type { BudgetAction, PilotageData } from "./types";

type Category = keyof typeof categoryLabels;
export function PilotageActionForm({ action, initialPostId, posts, onClose, onSaved }: {
  action?: BudgetAction; initialPostId: string; posts: PilotageData["posts"]; onClose: () => void; onSaved: () => void;
}) {
  const [postId, setPostId] = useState(action?.postId ?? initialPostId);
  const [label, setLabel] = useState(action?.label ?? "");
  const [status, setStatus] = useState<BudgetActionStatus>(action?.status ?? "UNBUDGETED");
  const [gross, setGross] = useState(String(action?.revisedGross ?? 0));
  const [income, setIncome] = useState(String(action?.revisedClubIncome ?? 0));
  const [federation, setFederation] = useState(String(action?.revisedFederation ?? 0));
  const [revisionReason, setRevisionReason] = useState("");
  const [adjustment, setAdjustment] = useState(String(action?.adjustmentFederation ?? 0));
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [estimate, setEstimate] = useState(action?.estimatedFederation == null ? "" : String(action.estimatedFederation));
  const [month, setMonth] = useState(String(action?.plannedMonth ?? "none"));
  const [categories, setCategories] = useState<Category[]>(action?.fencingCategories ?? []);
  const [notes, setNotes] = useState(action?.notes ?? "");
  const [comment, setComment] = useState(action?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revisedChanged = !!action && (Number(gross) !== action.revisedGross || Number(income) !== action.revisedClubIncome || Number(federation) !== action.revisedFederation);
  const adjustmentChanged = !!action && Number(adjustment) !== action.adjustmentFederation;
  const endpoint = action ? "/api/budget-actions/" + encodeURIComponent(action.id) : "/api/budget-actions";
  async function send(payload?: object, method = action ? "PATCH" : "POST") {
    setBusy(true); setError(null);
    try {
      await pilotageRequest(endpoint, { method, ...(payload ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {}) });
      onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Impossible d’enregistrer l’action"); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void send({ label, status, revisedGross: Number(gross), revisedClubIncome: Number(income), revisedFederation: Number(federation),
      estimatedFederation: estimate.trim() === "" ? null : Number(estimate), plannedMonth: month === "none" ? null : Number(month), fencingCategories: categories, comment: comment || null,
      ...(action?.matrixKey != null ? {} : { notes: notes || null }),
      ...(action ? { adjustmentFederation: Number(adjustment), ...(revisionReason.trim() ? { revisionReason } : {}), ...(adjustmentReason.trim() ? { adjustmentReason } : {}) } : { postId }),
    });
  }
  function quickStatus(next: BudgetActionStatus) { void send({ status: next }); }
  return <Popup title={action ? "Modifier l’action" : "Ajouter une action"} busy={busy} onClose={onClose}>
    <div className="space-y-5"><ErrorMessage message={error} />
      {action && <div className="flex flex-wrap gap-2">
        {action.proposedSaving && action.status !== "CANCELLED" && <Button size="sm" variant="outline" disabled={busy} onClick={() => quickStatus("CANCELLED")}>Valider l’économie</Button>}
        {action.status !== "DONE" && action.status !== "CANCELLED" && <Button size="sm" variant="outline" disabled={busy} onClick={() => quickStatus("DONE")}>Marquer réalisée</Button>}
        {action.status !== "CANCELLED" && <Button size="sm" variant="outline" disabled={busy} onClick={() => quickStatus("CANCELLED")}>Annuler l’action</Button>}
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => { if (window.confirm("Supprimer définitivement l’action « " + action.label + " » ?")) void send(undefined, "DELETE"); }}>Supprimer</Button>
      </div>}
      <form onSubmit={submit} className="space-y-5"><fieldset disabled={busy} className="space-y-5">
        {!action && <FieldSelect id="action-post" label="Poste" value={postId} onChange={setPostId} options={posts.map(post => ({ value: post.id, label: post.code + " — " + post.label }))} />}
        <div className="space-y-1.5"><Label htmlFor="action-label">Libellé</Label><Input id="action-label" value={label} onChange={event => setLabel(event.target.value)} required maxLength={1000} /></div>
        <FieldSelect id="action-status" label="Statut" value={status} onChange={value => setStatus(value as BudgetActionStatus)} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} />
        <div className="grid gap-4 sm:grid-cols-3">{[
          { id: "action-federation", label: action ? "Montant révisé FFE (€)" : "Montant budgété FFE (€)", value: federation, set: setFederation },
          { id: "action-gross", label: action ? "Montant révisé brut (€)" : "Montant budgété brut (€)", value: gross, set: setGross },
          { id: "action-income", label: action ? "Recettes révisées (€)" : "Recettes budgétées (€)", value: income, set: setIncome },
        ].map(field => <div key={field.id} className="space-y-1.5"><Label htmlFor={field.id}>{field.label}</Label><Input id={field.id} type="number" min="0" max="9999999999.99" step="0.01" required value={field.value} onChange={event => field.set(event.target.value)} /></div>)}</div>
        {action && <>
          <div className="space-y-1.5"><Label htmlFor="action-revision">Motif de révision{revisedChanged ? " (obligatoire)" : ""}</Label><Input id="action-revision" value={revisionReason} onChange={event => setRevisionReason(event.target.value)} required={revisedChanged} maxLength={2000} />{action.revisionReason && <p className="text-xs text-slate-500">Dernier motif : {action.revisionReason}</p>}</div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="action-adjustment">Rallonge / ajustement FFE (€)</Label><Input id="action-adjustment" type="number" step="0.01" min={-Number(federation)} max="9999999999.99" required value={adjustment} onChange={event => setAdjustment(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="action-adjustment-reason">Motif d’ajustement{adjustmentChanged ? " (obligatoire)" : ""}</Label><Input id="action-adjustment-reason" value={adjustmentReason} onChange={event => setAdjustmentReason(event.target.value)} required={adjustmentChanged} maxLength={2000} /></div>
          </div>{action.adjustmentReason && <p className="text-xs text-slate-500">Dernier motif d’ajustement : {action.adjustmentReason}</p>}
        </>}
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="action-estimate">Estimation / engagé FFE (€)</Label><Input id="action-estimate" type="number" min="0" max="9999999999.99" step="0.01" placeholder="Aucune estimation" value={estimate} onChange={event => setEstimate(event.target.value)} /><p className="text-xs text-slate-500">Laisser vide pour aucune estimation.</p></div>
          <FieldSelect id="action-month" label="Mois prévu" value={month} onChange={setMonth} options={[{ value: "none", label: "Non précisé" }, ...Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: monthLabel(index + 1) }))]} />
        </div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Catégories d’âge</legend><div className="flex flex-wrap gap-4">{Object.entries(categoryLabels).map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categories.includes(value as Category)} onChange={event => setCategories(current => event.target.checked ? [...current, value as Category] : current.filter(category => category !== value))} />{label}</label>)}</div></fieldset>
        <div className="space-y-1.5"><Label htmlFor="action-notes">Notes de la matrice</Label><textarea id="action-notes" readOnly={action?.matrixKey != null} rows={4} maxLength={10000} value={notes} onChange={event => setNotes(event.target.value)} className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-primary" /></div>
        <div className="space-y-1.5"><Label htmlFor="action-comment">Commentaire de la commission</Label><textarea id="action-comment" rows={4} maxLength={10000} value={comment} onChange={event => setComment(event.target.value)} className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-primary" /></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Fermer</Button><Button type="submit">{busy ? "Enregistrement…" : "Enregistrer"}</Button></div>
      </fieldset></form>
    </div>
  </Popup>;
}
