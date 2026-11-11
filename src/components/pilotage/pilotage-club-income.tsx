"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/components/budget/utils";
import { countLabel, monthLabel } from "@/lib/budget-pilotage-labels";
import type { ClubIncomeState } from "@/lib/budget-club-income";
import type { PilotageData } from "./types";

const stateLabels: Record<ClubIncomeState, string> = { COLLECTED: "Encaissé", PARTIAL: "Partiel", PENDING: "À encaisser" };
const stateStyles: Record<ClubIncomeState, string> = {
  COLLECTED: "border-emerald-200 bg-emerald-50 text-emerald-700", PARTIAL: "border-amber-200 bg-amber-50 text-amber-700", PENDING: "border-slate-200 bg-slate-100 text-slate-600",
};
export function PilotageClubIncome({ data }: { data: PilotageData }) {
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);
  const { lines, posts, totals } = data.clubIncome;
  const filtered = lines.filter(line => !onlyOutstanding || line.outstanding > 0.5);
  const percent = totals.expected ? (100 * totals.collected / totals.expected).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " % de l’attendu" : "—";
  const indicators = [
    { label: "Attendu des clubs", value: totals.expected, detail: countLabel(totals.count, "action", "actions") },
    { label: "Encaissé", value: totals.collected, detail: percent },
    { label: "Reste à encaisser", value: totals.outstanding },
    { label: "Dont en retard", value: totals.overdue },
  ];
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{indicators.map((item, index) => <Card key={item.label} className={"shadow-institutional " + (index === 3 && item.value > 0 ? "border-accent text-accent" : "")}>
      <CardContent className="p-4"><p className="text-sm font-semibold">{item.label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatCurrency(item.value)}</p>{item.detail && <p className="mt-1 text-xs">{item.detail}</p>}</CardContent>
    </Card>)}</div>
    <Card className="shadow-institutional"><CardContent className="space-y-4 p-5">
      <label data-print-hide className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyOutstanding} onChange={event => setOnlyOutstanding(event.target.checked)} />Seulement ce qui reste à encaisser</label>
      <div className="max-w-full overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Mois</TableHead><TableHead>Attendu</TableHead><TableHead>Encaissé</TableHead><TableHead>Reste à encaisser</TableHead><TableHead>État</TableHead></TableRow></TableHeader><TableBody>
        {posts.map(post => {
          const items = filtered.filter(line => line.postCode === post.code);
          if (!items.length) return null;
          return <Fragment key={post.code}><TableRow className="bg-primary-50 hover:bg-primary-50"><TableCell colSpan={6}>
            <p className="font-bold text-primary">{post.code} — {post.label}</p><p className="mt-1 text-xs text-slate-600">Total du poste : attendu {formatCurrency(post.expected)} · encaissé {formatCurrency(post.collected)} · reste à encaisser {formatCurrency(post.outstanding)}</p>
          </TableCell></TableRow>
            {items.map(line => <TableRow key={line.id}>
              <TableCell className="min-w-56 font-semibold">{line.label}</TableCell><TableCell>{monthLabel(line.plannedMonth)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(line.expected)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(line.collected)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(line.outstanding)}</TableCell>
              <TableCell><div className="flex flex-wrap gap-1"><Badge variant="outline" className={stateStyles[line.state]}>{stateLabels[line.state]}</Badge>{line.overdue && <Badge variant="outline" className="border-accent/20 bg-accent-50 text-accent-700">En retard</Badge>}</div></TableCell>
            </TableRow>)}
          </Fragment>;
        })}
        {!filtered.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-slate-500">{lines.length ? "Tout est encaissé." : "Aucune recette club prévue pour " + data.fiscalYear.label + "."}</TableCell></TableRow>}
        {!!filtered.length && <TableRow className="font-bold"><TableCell colSpan={2}>Total</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(totals.expected)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(totals.collected)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(totals.outstanding)}</TableCell><TableCell /></TableRow>}
      </TableBody></Table></div>
      <p className="text-xs text-slate-500">Attendu : recettes clubs du budget révisé. Encaissé : recettes réalisées de la dernière matrice importée. Une recette est en retard quand le mois de l’action est passé.</p>
    </CardContent></Card>
  </div>;
}
