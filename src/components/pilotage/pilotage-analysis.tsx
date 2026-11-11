"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/components/budget/utils";
import { analysisPeriods, buildBreakdown, buildCurve, buildPeriodTable, type Axis, type Granularity, type Measure } from "@/lib/budget-analysis";
import { FieldSelect } from "./shared";
import { PilotageCurve } from "./pilotage-curve";
import type { PilotageData } from "./types";

const axisTitles = { post: "par poste", team: "par équipe", nature: "par nature de dépense" };
export function PilotageAnalysis({ data }: { data: PilotageData }) {
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [cumulative, setCumulative] = useState(false);
  const [axis, setAxis] = useState<Axis>("post");
  const [measure, setMeasure] = useState<Measure>("landing");
  const periods = analysisPeriods(granularity, data.fiscalYear.label);
  const table = buildPeriodTable(data.actions, periods, cumulative);
  const breakdown = buildBreakdown({ axis, measure, posts: data.posts, actions: data.actions, natures: data.natures, periods, cumulative });
  const points = buildCurve(data.actions, { asOfDate: data.asOfDate, fiscalYearLabel: data.fiscalYear.label });
  return <div className="space-y-4">
    <div data-print-hide className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <FieldSelect id="analysis-period" label="Période" value={granularity} onChange={value => setGranularity(value as Granularity)} options={[{ value: "month", label: "Par mois" }, { value: "quarter", label: "Par trimestre" }, { value: "season", label: "Par saison sportive" }]} />
      <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={cumulative} onChange={event => setCumulative(event.target.checked)} />Cumul depuis janvier</label>
      <FieldSelect id="analysis-axis" label="Répartition" value={axis} onChange={value => setAxis(value as Axis)} options={[{ value: "post", label: "Par poste" }, { value: "team", label: "Par équipe" }, { value: "nature", label: "Par nature de dépense" }]} />
      <FieldSelect id="analysis-measure" label="Montant" value={measure} onChange={value => setMeasure(value as Measure)} disabled={axis === "nature"} options={[{ value: "budget", label: "Budget FFE" }, { value: "actual", label: "Réalisé fédé" }, { value: "landing", label: "Atterrissage" }]} />
    </div>
    <Card className="shadow-institutional"><CardContent className="space-y-4 p-5">
      <h3 className="text-lg font-bold text-primary">Budget, réalisé et atterrissage cumulés</h3>
      <PilotageCurve points={points} asOfDate={data.asOfDate} />
    </CardContent></Card>
    <Card className="shadow-institutional"><CardContent className="space-y-4 p-5">
      <h3 className="text-lg font-bold text-primary">Par période</h3>
      <div className="max-w-full overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Période</TableHead><TableHead>Actions</TableHead><TableHead>Budget FFE</TableHead><TableHead>Réalisé fédé</TableHead><TableHead>Reste à venir</TableHead><TableHead>Atterrissage (total)</TableHead><TableHead>Marge</TableHead></TableRow></TableHeader><TableBody>
        {[...table.rows, ...(table.undated.count ? [table.undated] : []), table.total].map(row => <TableRow key={row.key} className={row.key === "TOTAL" ? "font-bold" : ""}>
          <TableCell>{row.label}</TableCell><TableCell className="tabular-nums">{row.count}</TableCell>
          {[row.budget, row.actual, row.remaining, row.landing].map((amount, index) => <TableCell key={index} className="whitespace-nowrap tabular-nums">{formatCurrency(amount)}</TableCell>)}
          <TableCell className={"whitespace-nowrap tabular-nums " + (row.margin < 0 ? "font-semibold text-accent-700" : "")}>{formatCurrency(row.margin)}</TableCell>
        </TableRow>)}
      </TableBody></Table></div>
    </CardContent></Card>
    <Card className="shadow-institutional"><CardContent className="space-y-4 p-5">
      <h3 className="text-lg font-bold text-primary">Répartition {axisTitles[axis]}</h3>
      {axis === "nature" && <p className="text-sm text-slate-500">Notes de frais saisies dans l’appli en {data.fiscalYear.label}, rangées au mois de leur date. La matrice fédé ne détaille pas le réalisé par nature.</p>}
      {axis === "nature" && !breakdown.rows.length && <p className="text-sm text-slate-500">Aucune note de frais saisie en {data.fiscalYear.label}.</p>}
      <div className="max-w-full overflow-x-auto"><Table><TableHeader><TableRow><TableHead>{axis === "post" ? "Poste" : axis === "team" ? "Équipe" : "Nature de dépense"}</TableHead>
        {periods.map(period => <TableHead key={period.key}>{period.label}</TableHead>)}{axis !== "nature" && <TableHead>Sans mois</TableHead>}<TableHead>Total</TableHead>
      </TableRow></TableHeader><TableBody>
        {breakdown.rows.map(row => <TableRow key={row.key}><TableCell>{row.label}</TableCell>
          {row.cells.map((amount, index) => <TableCell key={periods[index].key} className="whitespace-nowrap tabular-nums">{formatCurrency(amount)}</TableCell>)}
          {axis !== "nature" && <TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(row.undated)}</TableCell>}<TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(row.total)}</TableCell>
        </TableRow>)}
        <TableRow className="font-bold"><TableCell>Total</TableCell>
          {breakdown.totals.cells.map((amount, index) => <TableCell key={periods[index].key} className="whitespace-nowrap tabular-nums">{formatCurrency(amount)}</TableCell>)}
          {axis !== "nature" && <TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(breakdown.totals.undated)}</TableCell>}<TableCell className="whitespace-nowrap tabular-nums">{formatCurrency(breakdown.totals.total)}</TableCell>
        </TableRow>
      </TableBody></Table></div>
    </CardContent></Card>
    <p className="text-xs text-slate-500">Le réalisé fédé n’est pas daté dans la matrice : il est rangé au mois prévu de chaque action. Les actions sans mois sont comptées à part.</p>
  </div>;
}
