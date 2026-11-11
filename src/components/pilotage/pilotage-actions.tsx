"use client";

import { Fragment, useState } from "react";
import { Lightbulb, Plus } from "lucide-react";
import type { BudgetActionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/components/budget/utils";
import { categoryLabels, countLabel, flagLabels, monthLabel, statusLabels } from "@/lib/budget-pilotage-labels";
import { FieldSelect } from "./shared";
import { PilotageActionForm } from "./pilotage-action-form";
import type { BudgetAction, PilotageData } from "./types";

const statusStyles: Record<BudgetActionStatus, string> = {
  OPTION: "border-slate-200 bg-slate-100 text-slate-600", BUDGETED: "border-blue-200 bg-blue-50 text-blue-700",
  COMMITTED: "border-purple-200 bg-purple-50 text-purple-700", DONE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-accent/20 bg-accent-50 text-accent-700", UNBUDGETED: "border-amber-200 bg-amber-50 text-amber-700",
};
export function PilotageActions({ data, canManage, postCode, onPostChange, onChanged }: {
  data: PilotageData; canManage: boolean; postCode: string; onPostChange: (code: string) => void; onChanged: () => void;
}) {
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [showGross, setShowGross] = useState(false);
  const [editor, setEditor] = useState<{ action?: BudgetAction; postId: string } | null>(null);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR");
  const filtered = data.actions.filter(action => (postCode === "all" || action.postCode === postCode) && (status === "all" || action.status === status) &&
    (category === "all" || action.fencingCategories.some(value => value === category)) && normalize(action.label + " " + (action.notes ?? "") + " " + (action.comment ?? "")).includes(normalize(search.trim())));
  const columns = showGross ? 12 : 8;
  const add = (postId = data.posts.find(post => post.code === postCode)?.id ?? data.posts[0]?.id) => { if (postId) setEditor({ postId }); };
  return <div className="space-y-4">
    <div data-print-hide className="flex flex-wrap items-end justify-between gap-3"><p className="text-sm text-slate-500">{filtered.length} action(s) · montants en part FFE</p>
      {canManage && <Button onClick={() => add()} disabled={!data.posts.length}><Plus className="mr-2 h-4 w-4" />Ajouter une action</Button>}
    </div>
    <Card className="shadow-institutional"><CardContent className="space-y-4 p-5"><div data-print-hide className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <FieldSelect id="filter-post" label="Poste" value={postCode} onChange={onPostChange} options={[{ value: "all", label: "Tous les postes" }, ...data.posts.map(post => ({ value: post.code, label: post.code + " — " + post.label }))]} />
      <FieldSelect id="filter-status" label="Statut" value={status} onChange={setStatus} options={[{ value: "all", label: "Tous les statuts" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} />
      <FieldSelect id="filter-category" label="Catégorie d’âge" value={category} onChange={setCategory} options={[{ value: "all", label: "Toutes les catégories" }, ...Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))]} />
      <div className="space-y-1.5"><Label htmlFor="action-search">Recherche</Label><Input id="action-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Libellé, notes ou commentaire" /></div>
    </div><label data-print-hide className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showGross} onChange={event => setShowGross(event.target.checked)} />Afficher brut et recettes</label>
      <div className="max-w-full overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Statut</TableHead><TableHead>Budget FFE</TableHead><TableHead>Réalisé fédé</TableHead><TableHead>Reste à venir</TableHead><TableHead>Atterrissage (total)</TableHead><TableHead>Écart</TableHead><TableHead>Drapeau</TableHead>
        {showGross && <><TableHead>Brut budgété</TableHead><TableHead>Recettes budgétées</TableHead><TableHead>Brut réalisé</TableHead><TableHead>Recettes réalisées</TableHead></>}
      </TableRow></TableHeader><TableBody>
        {data.posts.filter(post => postCode === "all" || post.code === postCode).map(post => {
          const actions = filtered.filter(action => action.postId === post.id);
          const summary = data.summary.posts.find(item => item.code === post.code)!;
          if (!actions.length && (search || status !== "all" || category !== "all")) return null;
          return <Fragment key={post.id}><TableRow className="bg-primary-50 hover:bg-primary-50"><TableCell colSpan={columns}>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-primary">{post.code} — {post.label}</p><p className="mt-1 text-xs text-slate-600">Total du poste : budget {formatCurrency(summary.budget)} · réalisé {formatCurrency(summary.actual)} · reste à venir {formatCurrency(summary.remaining)} · atterrissage (total) {formatCurrency(summary.landing)}</p></div>
              {canManage && <Button data-print-hide size="sm" variant="outline" onClick={() => add(post.id)}>Ajouter une action</Button>}
            </div></TableCell></TableRow>
            {actions.map(action => {
              const figures = action.figures;
              const flag = figures.actual > figures.budget + 0.5 ? "red" : figures.landing > figures.budget + 0.5 ? "orange" : "green";
              return <TableRow key={action.id} className={canManage ? "cursor-pointer" : ""} onClick={canManage ? () => setEditor({ action, postId: post.id }) : undefined}>
                <TableCell className="min-w-56"><div className="flex items-start gap-2">
                  {canManage ? <button className="text-left font-semibold text-primary underline-offset-4 hover:underline" onClick={event => { event.stopPropagation(); setEditor({ action, postId: post.id }); }}>{action.label}</button> : <span className="font-semibold">{action.label}</span>}
                  {action.proposedSaving && <span title="Économie proposée à valider"><Lightbulb className="h-4 w-4 text-amber-600" aria-label="Économie proposée" /></span>}
                </div>{action.comment && <p className="mt-1 line-clamp-2 text-xs italic text-slate-500" title={action.comment}>{action.comment}</p>}<div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500"><span>{monthLabel(action.plannedMonth)}</span>{action.fencingCategories.map(value => <Badge key={value} variant="outline">{categoryLabels[value]}</Badge>)}</div></TableCell>
                <TableCell><Badge variant="outline" className={statusStyles[action.status]}>{statusLabels[action.status]}</Badge>{action.status === "DONE" && !action.isSettled && <Badge variant="outline" className="mt-1 border-amber-200 bg-amber-50 text-amber-700">En attente de factures</Badge>}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(figures.budget)}{figures.budget !== action.initialFederation && <p className="text-xs text-slate-400 line-through">{formatCurrency(action.initialFederation)}</p>}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(figures.actual)}
                  {action.entered.count > 0 && <p className="text-xs text-slate-500">saisi : {formatCurrency(action.entered.amount)} ({countLabel(action.entered.count, "note", "notes")})</p>}
                  {action.entered.notBooked > 0.5 && <p className="text-xs font-semibold text-amber-700">dont {formatCurrency(action.entered.notBooked)} pas encore repris par la fédé</p>}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(figures.remaining)}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(figures.landing)}</TableCell><TableCell className={"whitespace-nowrap tabular-nums " + (figures.variance > 0 ? "font-semibold text-accent-700" : "")}>{formatCurrency(figures.variance)}</TableCell>
                <TableCell><span role="img" aria-label={flagLabels[flag]} title={flagLabels[flag]} className={"inline-block h-3 w-3 rounded-full " + ({ green: "bg-emerald-500", orange: "bg-amber-500", red: "bg-accent" }[flag])} /></TableCell>
                {showGross && [action.revisedGross, action.revisedClubIncome, action.actualGross, action.actualClubIncome].map((amount, index) => <TableCell key={index} className="whitespace-nowrap tabular-nums">{amount === null ? "—" : formatCurrency(amount)}</TableCell>)}
              </TableRow>;
            })}
          </Fragment>;
        })}
        {!filtered.length && <TableRow><TableCell colSpan={columns} className="py-8 text-center text-slate-500">Aucune action ne correspond aux filtres.</TableCell></TableRow>}
      </TableBody></Table></div>
    </CardContent></Card>
    {canManage && editor && <PilotageActionForm action={editor.action} initialPostId={editor.postId} posts={data.posts} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); onChanged(); }} />}
  </div>;
}
