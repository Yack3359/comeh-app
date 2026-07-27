"use client";

import { Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { BudgetRow } from "./types";
import { formatCurrency, requestJson } from "./utils";

type BudgetEditorProps = {
  seasonId: string;
  canManage: boolean;
  categoryVersion: number;
  onChanged: () => void;
};

export function BudgetEditor({
  seasonId,
  canManage,
  categoryVersion,
  onChanged,
}: BudgetEditorProps) {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBudget = useCallback(async () => {
    if (!seasonId) {
      setRows([]);
      return;
    }

    try {
      setError(null);
      setRows(
        await requestJson<BudgetRow[]>(
          `/api/budgets?seasonId=${encodeURIComponent(seasonId)}`,
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    }
  }, [seasonId]);

  useEffect(() => {
    void loadBudget();
  }, [categoryVersion, loadBudget]);

  async function saveBudget() {
    setIsPending(true);
    setError(null);
    setMessage(null);

    try {
      await requestJson("/api/budgets", {
        method: "PUT",
        body: JSON.stringify({
          seasonId,
          budgets: rows.map((row) => ({
            categoryId: row.id,
            plannedAmount: row.plannedAmount || "0",
          })),
        }),
      });
      setMessage("Budget prévisionnel enregistré.");
      await loadBudget();
      onChanged();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Enregistrement impossible",
      );
    } finally {
      setIsPending(false);
    }
  }

  const total = rows.reduce(
    (sum, row) => sum + (Number(row.plannedAmount.replace(",", ".")) || 0),
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Budget prévisionnel</CardTitle>
        <CardDescription>
          Renseignez le montant prévu pour chaque catégorie. Les montants sont
          enregistrés en euros.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <p
            aria-live="polite"
            className="rounded-md border border-accent/20 bg-accent-50 px-3 py-2 text-sm text-accent-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {message ? (
          <p
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {message}
          </p>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Catégorie</TableHead>
              <TableHead className="w-56 text-right">Montant prévu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  {canManage ? (
                    <div className="relative">
                      <Input
                        aria-label={`Budget prévu pour ${row.name}`}
                        className="pr-9 text-right tabular-nums"
                        min="0"
                        onChange={(event) =>
                          setRows((currentRows) =>
                            currentRows.map((currentRow, currentIndex) =>
                              currentIndex === index
                                ? {
                                    ...currentRow,
                                    plannedAmount: event.target.value,
                                  }
                                : currentRow,
                            ),
                          )
                        }
                        step="0.01"
                        type="number"
                        value={row.plannedAmount}
                      />
                      <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-slate-500">
                        €
                      </span>
                    </div>
                  ) : (
                    <p className="text-right tabular-nums">
                      {formatCurrency(row.plannedAmount)}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  className="py-10 text-center text-slate-500"
                  colSpan={2}
                >
                  Créez d’abord au moins une catégorie de budget.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <div className="flex flex-col items-start justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-600">
            Total prévu :{" "}
            <strong className="text-base text-primary">
              {formatCurrency(total)}
            </strong>
          </p>
          {canManage ? (
            <Button
              disabled={isPending || rows.length === 0}
              onClick={() => void saveBudget()}
              type="button"
            >
              <Save className="mr-2 h-4 w-4" />
              {isPending ? "Enregistrement…" : "Enregistrer le budget"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

