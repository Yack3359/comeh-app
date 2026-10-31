"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/components/budget/utils";
import type { PilotageData } from "./types";

export function PilotageHistory({ data }: { data: PilotageData }) {
  const chronological = [...data.snapshots].reverse();
  const summaries = new Map(data.snapshotSummaries.map(snapshot => [snapshot.id, snapshot]));
  const posts = new Map<string, string>();
  for (const snapshot of chronological) for (const post of summaries.get(snapshot.id)?.posts ?? []) posts.set(post.code, post.label);
  const rows = [...posts].sort(([a], [b]) => a.localeCompare(b));
  return <div className="space-y-6"><Card className="shadow-institutional"><CardHeader><CardTitle>Historique des imports</CardTitle></CardHeader><CardContent>
    {!data.snapshots.length ? <p className="text-sm text-slate-500">Aucun import pour cet exercice.</p> : <Table><TableHeader><TableRow>
      <TableHead>Situation au</TableHead><TableHead>Fichier</TableHead><TableHead>Importé par</TableHead><TableHead>Date d’import</TableHead>
    </TableRow></TableHeader><TableBody>{data.snapshots.map(snapshot => <TableRow key={snapshot.id}>
      <TableCell>{formatDate(snapshot.asOfDate)}</TableCell><TableCell className="break-all">{snapshot.sourceFileName}</TableCell><TableCell>{snapshot.importedBy.name ?? "—"}</TableCell>
      <TableCell>{new Date(snapshot.createdAt).toLocaleString("fr-FR")}</TableCell>
    </TableRow>)}</TableBody></Table>}
  </CardContent></Card>
    {!!chronological.length && <Card className="shadow-institutional"><CardHeader><CardTitle>Évolution mois par mois</CardTitle></CardHeader><CardContent>
      <p className="mb-3 text-sm text-slate-500">Réalisé FFE ; atterrissage estimé en dessous. Une colonne par import.</p>
      <Table><TableHeader><TableRow><TableHead>Poste</TableHead>{chronological.map(snapshot => <TableHead key={snapshot.id} title={snapshot.sourceFileName}>{formatDate(snapshot.asOfDate)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{[...rows, ["total", "Total"]].map(([code, label]) => <TableRow key={code} className={code === "total" ? "bg-primary-50 font-bold" : ""}>
          <TableCell>{code === "total" ? label : code + " — " + label}</TableCell>{chronological.map(snapshot => {
            const summary = summaries.get(snapshot.id);
            const values = code === "total" ? summary?.totals : summary?.posts.find(post => post.code === code);
            return <TableCell key={snapshot.id} className="whitespace-nowrap tabular-nums">{values ? <>{formatCurrency(values.actual)}<p className="mt-1 text-xs font-normal text-slate-500">Atterrissage : {formatCurrency(values.landing)}</p></> : <span title="Poste absent ou données indisponibles dans cet import">—</span>}</TableCell>;
          })}
        </TableRow>)}</TableBody>
      </Table>
    </CardContent></Card>}
  </div>;
}
