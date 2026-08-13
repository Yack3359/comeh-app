"use client";

import { Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fencingCategories,
  fencingCategoryLabels,
  fencingCategoryStyles,
  type FencingCategoryValue,
} from "@/components/fencing-category";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { BudgetRow, Season } from "./types";
import { formatCurrency, requestJson } from "./utils";

type BudgetEditorProps = {
  seasonId: string;
  canManage: boolean;
  categoryVersion: number;
  onChanged: () => void;
  seasons: Season[];
};

type BudgetView = FencingCategoryValue;

function budgetKey(categoryId: string, fencingCategory: FencingCategoryValue) {
  return `${categoryId}:${fencingCategory}`;
}

function amountForView(row: BudgetRow, view: BudgetView) {
  return (
    row.budgets.find((budget) => budget.fencingCategory === view)
      ?.plannedAmount ?? "0"
  );
}

function totalForRow(row: BudgetRow) {
  return row.budgets.reduce(
    (sum, budget) => sum + (Number(budget.plannedAmount) || 0),
    0,
  );
}

export function BudgetEditor({
  seasonId,
  canManage,
  categoryVersion,
  onChanged,
  seasons,
}: BudgetEditorProps) {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [view, setView] = useState<BudgetView>(fencingCategories[0]);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previousAmounts, setPreviousAmounts] = useState<Map<string, number>>(
    new Map(),
  );

  const previousSeason = useMemo(() => {
    const current = seasons.find((item) => item.id === seasonId);
    if (!current) {
      return undefined;
    }
    return seasons
      .filter((season) => season.startDate < current.startDate)
      .sort((left, right) => right.startDate.localeCompare(left.startDate))[0];
  }, [seasonId, seasons]);

  const loadBudget = useCallback(async () => {
    if (!seasonId) {
      setRows([]);
      return;
    }

    try {
      setError(null);
      const data = await requestJson<BudgetRow[]>(
        `/api/budgets?seasonId=${encodeURIComponent(seasonId)}`,
      );
      setRows(data);
      setDirtyKeys(new Set());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    }
  }, [seasonId]);

  useEffect(() => {
    void loadBudget();
  }, [categoryVersion, loadBudget]);

  useEffect(() => {
    if (!previousSeason) {
      setPreviousAmounts(new Map());
      return;
    }

    void requestJson<BudgetRow[]>(
      `/api/budgets?seasonId=${encodeURIComponent(previousSeason.id)}`,
    )
      .then((data) => {
        const map = new Map<string, number>();
        data.forEach((row) => {
          row.budgets.forEach((budget) => {
            map.set(
              `${row.name}:${budget.fencingCategory}`,
              Number(budget.plannedAmount),
            );
          });
        });
        setPreviousAmounts(map);
      })
      .catch(() => setPreviousAmounts(new Map()));
  }, [previousSeason]);

  async function saveBudget() {
    const budgets = rows.flatMap((row) =>
      row.budgets
        .filter((budget) =>
          dirtyKeys.has(budgetKey(row.id, budget.fencingCategory)),
        )
        .map((budget) => ({
          categoryId: row.id,
          fencingCategory: budget.fencingCategory,
          plannedAmount: budget.plannedAmount || "0",
        })),
    );

    if (budgets.length === 0) {
      return;
    }

    setIsPending(true);
    setError(null);
    setMessage(null);

    try {
      await requestJson("/api/budgets", {
        method: "PUT",
        body: JSON.stringify({
          seasonId,
          budgets,
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
    (sum, row) =>
      sum + (Number(amountForView(row, view).replace(",", ".")) || 0),
    0,
  );
  const grandTotal = rows.reduce((sum, row) => sum + totalForRow(row), 0);
  const viewLabel = fencingCategoryLabels[view];

  const totalByCategory = fencingCategories.map((fencingCategory) => ({
    fencingCategory,
    total: rows.reduce(
      (sum, row) =>
        sum +
        (Number(
          row.budgets.find((budget) => budget.fencingCategory === fencingCategory)
            ?.plannedAmount ?? "0",
        ) || 0),
      0,
    ),
  }));

  function updateAmount(rowId: string, value: string) {
    const fencingCategory = view;

    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const existingIndex = row.budgets.findIndex(
          (budget) => budget.fencingCategory === fencingCategory,
        );
        const budgets = [...row.budgets];

        if (existingIndex >= 0) {
          budgets[existingIndex] = {
            ...budgets[existingIndex],
            plannedAmount: value,
          };
        } else {
          budgets.push({
            budgetId: null,
            fencingCategory,
            plannedAmount: value,
          });
        }

        return { ...row, budgets };
      }),
    );
    setDirtyKeys((current) => {
      const next = new Set(current);
      next.add(budgetKey(rowId, fencingCategory));
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Budget prévisionnel</CardTitle>
        <CardDescription>
          Renseignez chaque type de dépense dans la vue globale historique ou
          dans une allocation propre à une catégorie de tireur.
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

        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-semibold text-primary">
            Synthèse de pilotage — montant prévu cumulé par catégorie
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {totalByCategory.map(({ fencingCategory, total: categoryTotal }) => (
              <div
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                key={fencingCategory}
              >
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <span
                    className={`h-2 w-2 rounded-full ${fencingCategoryStyles[fencingCategory].progress}`}
                  />
                  {fencingCategoryLabels[fencingCategory].split(" ")[0]}
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                  {formatCurrency(categoryTotal)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Total toutes catégories confondues (calculé) :{" "}
            <strong className="text-primary">{formatCurrency(grandTotal)}</strong>
          </p>
        </div>

        <Tabs
          onValueChange={(value) => setView(value as BudgetView)}
          value={view}
        >
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-3 xl:grid-cols-6">
            {fencingCategories.map((fencingCategory) => (
              <TabsTrigger key={fencingCategory} value={fencingCategory}>
                <span
                  className={`mr-2 h-2.5 w-2.5 rounded-full ${
                    fencingCategoryStyles[fencingCategory].progress
                  }`}
                />
                {fencingCategoryLabels[fencingCategory].split(" ")[0]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Montants affichés pour{" "}
          <strong className="text-slate-900">{viewLabel}</strong>.
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Catégorie</TableHead>
              {previousSeason ? (
                <TableHead className="w-40 text-right text-slate-400">
                  N-1 ({previousSeason.label})
                </TableHead>
              ) : null}
              <TableHead className="w-56 text-right">
                Montant prévu ({viewLabel})
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const previousAmount = previousAmounts.get(`${row.name}:${view}`);

              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  {previousSeason ? (
                    <TableCell className="text-right tabular-nums text-slate-400">
                      {previousAmount !== undefined
                        ? formatCurrency(previousAmount)
                        : "—"}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    {canManage ? (
                      <div className="relative">
                        <Input
                          aria-label={`Budget prévu pour ${row.name}, ${viewLabel}`}
                          className="pr-9 text-right tabular-nums"
                          min="0"
                          onChange={(event) =>
                            updateAmount(row.id, event.target.value)
                          }
                          step="0.01"
                          type="number"
                          value={amountForView(row, view)}
                        />
                        <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-slate-500">
                          €
                        </span>
                      </div>
                    ) : (
                      <p className="text-right tabular-nums">
                        {formatCurrency(amountForView(row, view))}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  className="py-10 text-center text-slate-500"
                  colSpan={previousSeason ? 3 : 2}
                >
                  Créez d’abord au moins une catégorie de budget.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <div className="flex flex-col items-start justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-600">
            Total prévu ({viewLabel}) :{" "}
            <strong className="text-base text-primary">
              {formatCurrency(total)}
            </strong>
          </p>
          {canManage ? (
            <Button
              disabled={
                isPending || rows.length === 0 || dirtyKeys.size === 0
              }
              onClick={() => void saveBudget()}
              type="button"
            >
              <Save className="mr-2 h-4 w-4" />
              {isPending ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
