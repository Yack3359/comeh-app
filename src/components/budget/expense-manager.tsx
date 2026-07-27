"use client";

import { PlusCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { SeasonSelect } from "./season-select";
import type { BudgetCategory, Expense, Season } from "./types";
import {
  dateInputValue,
  expenseTypeLabels,
  formatCurrency,
  formatDate,
  requestJson,
} from "./utils";

type ExpenseManagerProps = {
  seasons: Season[];
  seasonId: string;
  canManage: boolean;
  categoryVersion: number;
  onSeasonChange: (seasonId: string) => void;
  onChanged: () => void;
};

function initialDate(season?: Season) {
  const today = new Date();
  const todayValue = dateInputValue(today);

  if (!season) {
    return todayValue;
  }

  const startDate = season.startDate.slice(0, 10);
  const endDate = season.endDate.slice(0, 10);

  if (todayValue < startDate) {
    return startDate;
  }

  if (todayValue > endDate) {
    return endDate;
  }

  return todayValue;
}

export function ExpenseManager({
  seasons,
  seasonId,
  canManage,
  categoryVersion,
  onSeasonChange,
  onChanged,
}: ExpenseManagerProps) {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] =
    useState<keyof typeof expenseTypeLabels>("ACCOMMODATION");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [relatedEvent, setRelatedEvent] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const currentSeason = useMemo(
    () => seasons.find((season) => season.id === seasonId),
    [seasonId, seasons],
  );

  const loadCategories = useCallback(async () => {
    if (!seasonId) {
      setCategories([]);
      return;
    }

    const data = await requestJson<BudgetCategory[]>(
      `/api/budget-categories?seasonId=${encodeURIComponent(seasonId)}`,
    );
    setCategories(data);
    setCategoryId((current) =>
      data.some((category) => category.id === current)
        ? current
        : (data[0]?.id ?? ""),
    );
  }, [seasonId]);

  const loadExpenses = useCallback(async () => {
    if (!seasonId) {
      setExpenses([]);
      return;
    }

    const params = new URLSearchParams({ seasonId });
    if (categoryFilter !== "all") {
      params.set("categoryId", categoryFilter);
    }
    if (typeFilter !== "all") {
      params.set("type", typeFilter);
    }

    setExpenses(await requestJson<Expense[]>(`/api/expenses?${params}`));
  }, [categoryFilter, seasonId, typeFilter]);

  useEffect(() => {
    setCategoryFilter("all");
    setDate(initialDate(currentSeason));
  }, [currentSeason]);

  useEffect(() => {
    setError(null);
    void loadCategories().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    });
  }, [categoryVersion, loadCategories]);

  useEffect(() => {
    setError(null);
    void loadExpenses().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    });
  }, [loadExpenses]);

  async function createExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setMessage(null);

    try {
      await requestJson("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          seasonId,
          categoryId,
          type,
          amount,
          date,
          description,
          relatedEvent,
        }),
      });
      setAmount("");
      setDescription("");
      setRelatedEvent("");
      setMessage("Note de frais enregistrée.");
      await loadExpenses();
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

  return (
    <div className="space-y-5">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Saisir une note de frais</CardTitle>
            <CardDescription>
              La dépense sera attribuée automatiquement à votre compte et marquée
              comme saisie manuelle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={createExpense}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="expense-season">Saison</Label>
                  <SeasonSelect
                    id="expense-season"
                    onValueChange={onSeasonChange}
                    seasons={seasons}
                    value={seasonId}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-category">Catégorie</Label>
                  <Select onValueChange={setCategoryId} value={categoryId}>
                    <SelectTrigger id="expense-category">
                      <SelectValue placeholder="Choisir une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-type">Type</Label>
                  <Select
                    onValueChange={(value) =>
                      setType(value as keyof typeof expenseTypeLabels)
                    }
                    value={type}
                  >
                    <SelectTrigger id="expense-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACCOMMODATION">Hébergement</SelectItem>
                      <SelectItem value="TRAVEL">Déplacement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-amount">Montant</Label>
                  <div className="relative">
                    <Input
                      className="pr-9"
                      id="expense-amount"
                      min="0.01"
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0,00"
                      required
                      step="0.01"
                      type="number"
                      value={amount}
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-slate-500">
                      €
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expense-date">Date</Label>
                  <Input
                    id="expense-date"
                    max={currentSeason?.endDate.slice(0, 10)}
                    min={currentSeason?.startDate.slice(0, 10)}
                    onChange={(event) => setDate(event.target.value)}
                    required
                    type="date"
                    value={date}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-related">
                    Compétition / déplacement{" "}
                    <span className="font-normal text-slate-400">(facultatif)</span>
                  </Label>
                  <Input
                    id="expense-related"
                    maxLength={160}
                    onChange={(event) => setRelatedEvent(event.target.value)}
                    placeholder="Ex. Coupe du monde de Paris"
                    value={relatedEvent}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-description">Description</Label>
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  id="expense-description"
                  maxLength={500}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Détail du frais, personne concernée, trajet…"
                  required
                  value={description}
                />
              </div>

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

              <div className="flex justify-end">
                <Button
                  disabled={isPending || !categoryId}
                  type="submit"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {isPending ? "Enregistrement…" : "Enregistrer le frais"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Frais enregistrés</CardTitle>
          <CardDescription>
            Filtrez la saison depuis l’en-tête du module, puis affinez par
            catégorie ou par type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-category-filter">Catégorie</Label>
              <Select
                onValueChange={setCategoryFilter}
                value={categoryFilter}
              >
                <SelectTrigger id="expense-category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-type-filter">Type</Label>
              <Select onValueChange={setTypeFilter} value={typeFilter}>
                <SelectTrigger id="expense-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="ACCOMMODATION">Hébergement</SelectItem>
                  <SelectItem value="TRAVEL">Déplacement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!canManage && error ? (
            <p className="text-sm text-accent-700" role="alert">
              {error}
            </p>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Détail</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Saisi par</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(expense.date)}
                  </TableCell>
                  <TableCell className="min-w-56">
                    <p className="font-medium text-slate-900">
                      {expense.description}
                    </p>
                    {expense.relatedEvent ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {expense.relatedEvent}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>{expense.category.name}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        expense.type === "ACCOMMODATION"
                          ? "border-blue-200 bg-blue-50 text-blue-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }
                      variant="outline"
                    >
                      {expenseTypeLabels[expense.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {expense.createdBy.name}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(expense.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-slate-500"
                    colSpan={6}
                  >
                    Aucun frais ne correspond à ces filtres.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

