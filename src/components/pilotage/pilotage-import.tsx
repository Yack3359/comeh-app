"use client";

import { useState } from "react";
import type { BudgetActionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/components/budget/utils";
import { statusLabels } from "@/lib/budget-pilotage-labels";
import { ErrorMessage, FieldSelect, pilotageRequest } from "./shared";
import type { ImportResult, MatrixPreview } from "./types";

const fieldLabels: Record<string, string> = {
  label: "Libellé",
  status: "Statut",
  includedInBudget: "Dans le budget",
  proposedSaving: "Économie proposée",
  revisedGross: "Budget brut",
  revisedClubIncome: "Recettes clubs",
  revisedFederation: "Part FFE",
  actualGross: "Réalisé brut",
  actualClubIncome: "Recettes réelles",
  actualFederation: "Réalisé FFE",
  previousYearAmount: "Prévi N-1",
  notes: "Notes",
  estimatedFederation: "Estimation",
};

function formatChangeValue(field: string, val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Oui" : "Non";
  if (field === "status" && typeof val === "string") return statusLabels[val as BudgetActionStatus] ?? val;
  if (
    typeof val === "number" ||
    [
      "revisedGross",
      "revisedClubIncome",
      "revisedFederation",
      "actualGross",
      "actualClubIncome",
      "actualFederation",
      "previousYearAmount",
      "estimatedFederation",
    ].includes(field)
  ) {
    return formatCurrency(val as number);
  }
  return String(val);
}

export function PilotageImport({ onImported }: { onImported: (fiscalYearLabel: string, result: ImportResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MatrixPreview | null>(null);
  const [asOfDate, setAsOfDate] = useState("");
  const [overrides, setOverrides] = useState<Record<number, string | null>>({});
  const [historicalOnly, setHistoricalOnly] = useState(false);
  const [previewValid, setPreviewValid] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setLoadingText("Analyse en cours…");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await pilotageRequest<MatrixPreview>("/api/budget-matrix/preview", {
        method: "POST",
        body: formData,
      });
      setPreview(res);
      setPreviewValid(true);
      setHistoricalOnly(false);
      setAsOfDate(res.parsed.asOfDate ?? new Date().toISOString().slice(0, 10));
      setOverrides({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue lors de l'analyse.");
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async (rowNumber: number, value: string) => {
    if (!file || !preview || loading || value === "__ambiguous__") return;
    const next = { ...overrides, [rowNumber]: value === "__new__" ? null : value };
    setOverrides(next);
    setPreviewValid(false);
    setLoading(true);
    setLoadingText("Recalcul de l’aperçu…");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fiscalYearLabel", preview.fiscalYear.label);
      formData.append("overrides", JSON.stringify(next));
      setPreview(await pilotageRequest<MatrixPreview>("/api/budget-matrix/preview", { method: "POST", body: formData }));
      setPreviewValid(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de recalculer l’aperçu.");
    } finally { setLoading(false); }
  };

  const handleApply = async () => {
    if (!preview || !asOfDate || loading || !previewValid || (!historicalOnly && preview.diff.actions.some(action => action.ambiguous))) return;
    setLoading(true);
    setLoadingText("Import en cours…");
    setError(null);
    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      const payload: { fiscalYearLabel: string; asOfDate: string; historicalOnly: boolean; overrides?: Record<number, string | null> } = {
        fiscalYearLabel: preview.fiscalYear.label,
        asOfDate, historicalOnly,
      };
      if (Object.keys(overrides).length > 0) {
        payload.overrides = overrides;
      }
      formData.append("payload", JSON.stringify(payload));

      const result = await pilotageRequest<ImportResult>("/api/budget-matrix/apply", {
        method: "POST",
        body: formData,
      });
      onImported(preview.fiscalYear.label, result);
      setPreview(null);
      setFile(null);
      setOverrides({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue lors de l'import.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setFile(null);
    setOverrides({});
    setError(null);
  };

  if (!preview) {
    return (
      <Card className="shadow-institutional">
        <CardHeader>
          <CardTitle>Importer la matrice du contrôleur de gestion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ErrorMessage message={error} />
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="matrix-file">Fichier Excel (.xlsx)</Label>
              <Input
                id="matrix-file"
                type="file"
                accept=".xlsx"
                disabled={loading}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="submit" disabled={!file || loading}>
              {loading ? loadingText : "Analyser le fichier"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  const newCount = preview.diff.actions.filter((a) => a.kind === "new").length;
  const updatedCount = preview.diff.actions.filter((a) => a.kind === "updated").length;
  const unchangedCount = preview.diff.actions.filter((a) => a.kind === "unchanged").length;
  const missingCount = preview.diff.missingActions.length;

  const displayedActions = preview.diff.actions.filter((a) => showUnchanged || a.kind !== "unchanged" || a.statusPreserved || a.ambiguous);

  return (
    <div className="space-y-6">
      <Card className="shadow-institutional">
        <CardHeader>
          <CardTitle>Analyse de la matrice — Exercice {preview.fiscalYear.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ErrorMessage message={error} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="as-of-date">Situation au</Label>
              <Input
                id="as-of-date"
                type="date"
                required
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                disabled={loading}
              />
            </div>
            {preview.parsed.restitutionAmount !== null && (
              <div className="flex flex-col justify-end">
                <p className="text-sm font-semibold text-primary">
                  Restitution détectée : {formatCurrency(preview.parsed.restitutionAmount)}
                </p>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={historicalOnly} disabled={loading} onChange={event => setHistoricalOnly(event.target.checked)} />Importer comme historique seulement</label>

          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {newCount} nouvelle(s)
            </Badge>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
              {updatedCount} modifiée(s)
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
              {unchangedCount} inchangée(s)
            </Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              {missingCount} absente(s)
            </Badge>
          </div>

          {preview.diff.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">Avertissements :</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {preview.diff.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.diff.ignoredRows.length > 0 && (
            <details className="text-sm text-slate-600">
              <summary className="cursor-pointer font-medium text-slate-700 hover:text-slate-900">
                Éléments non importés ({preview.diff.ignoredRows.length})
              </summary>
              <ul className="mt-2 space-y-1 pl-4 font-mono text-xs">
                {preview.diff.ignoredRows.map((row) => (
                  <li key={row.rowNumber}>
                    Ligne {row.rowNumber} : {row.text}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-primary">Actions de la matrice</h3>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showUnchanged}
                  onChange={(e) => setShowUnchanged(e.target.checked)}
                />
                Afficher les lignes inchangées
              </label>
            </div>

            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Changements</TableHead>
                    <TableHead className="min-w-64">Rapprochement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedActions.map((action) => {
                    const rowPostCode = preview.parsed.actions.find((a) => a.rowNumber === action.rowNumber)?.postCode;
                    const postExisting = preview.existingActions.filter((ea) => ea.postCode === rowPostCode);
                    const options = [
                      ...(action.ambiguous ? [{ value: "__ambiguous__", label: "Rapprochement manuel requis" }] : []),
                      { value: "__new__", label: "Nouvelle action" },
                      ...postExisting.map((ea) => ({ value: ea.id, label: ea.label })),
                    ];

                    const currentValue =
                      overrides[action.rowNumber] !== undefined
                        ? (overrides[action.rowNumber] ?? "__new__")
                        : (action.ambiguous ? "__ambiguous__" : action.actionId ?? "__new__");

                    return (
                      <TableRow key={action.rowNumber}>
                        <TableCell>
                          {action.ambiguous && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Rapprochement ambigu — choix manuel requis</Badge>}
                          {action.statusPreserved && <Badge variant="outline">Statut conservé</Badge>}
                          {action.kind === "new" && (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                              Nouvelle
                            </Badge>
                          )}
                          {action.kind === "updated" && (
                            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                              Modifiée
                            </Badge>
                          )}
                          {action.kind === "unchanged" && (
                            <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
                              Inchangée
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="min-w-48">
                          <div className="space-y-1">
                            <p className="font-semibold">{action.label}</p>
                            {action.previousLabel && action.previousLabel !== action.label && (
                              <p className="text-xs text-slate-400 line-through">{action.previousLabel}</p>
                            )}
                            {action.matchedBy === "position" && (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-xs">
                                Rapprochée par position — à vérifier
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {action.changes.length > 0 ? (
                            <ul className="space-y-0.5 text-xs text-slate-600">
                              {action.changes.map((c) => (
                                <li key={c.field}>
                                  <span className="font-medium text-slate-700">{fieldLabels[c.field] ?? c.field}</span> :{" "}
                                  {formatChangeValue(c.field, c.before)} → {formatChangeValue(c.field, c.after)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <FieldSelect
                            id={"match-" + action.rowNumber}
                            label=""
                            value={currentValue}
                            disabled={loading}
                            onChange={val => void handleMatch(action.rowNumber, val)}
                            options={options}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!displayedActions.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-slate-500">
                        Aucune ligne à afficher.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {preview.diff.missingActions.length > 0 && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-800">
                Absentes du fichier — elles ne seront pas supprimées ({preview.diff.missingActions.length})
              </h4>
              <ul className="list-disc pl-5 text-xs text-slate-600 space-y-0.5">
                {preview.diff.missingActions.map((ma) => (
                  <li key={ma.id}>
                    [{ma.postCode}] {ma.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={handleCancel} disabled={loading}>
              Annuler
            </Button>
            <Button type="button" onClick={handleApply} disabled={loading || !asOfDate || !previewValid || (!historicalOnly && preview.diff.actions.some(action => action.ambiguous))}>
              {loading ? loadingText : "Valider l'import"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
