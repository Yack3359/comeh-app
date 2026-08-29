"use client";

import {
  Download,
  Paperclip,
  Pencil,
  PlusCircle,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  fencingCategories,
  fencingCategoryLabels,
  fencingCategoryStyles,
  type FencingCategoryValue,
} from "@/components/fencing-category";
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
import type { BudgetCategory, Competition, Expense, Season } from "./types";
import {
  dateInputValue,
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
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groupByCompetition, setGroupByCompetition] = useState(false);
  const [viewingGroupKey, setViewingGroupKey] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [fencingCategory, setFencingCategory] = useState<
    FencingCategoryValue | "NONE"
  >("NONE");
  const [competitionId, setCompetitionId] = useState<string>("NONE");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [fencingCategoryFilter, setFencingCategoryFilter] = useState("all");
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editFencingCategory, setEditFencingCategory] = useState<
    FencingCategoryValue | "NONE"
  >("NONE");
  const [editCompetitionId, setEditCompetitionId] = useState("NONE");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAttachmentFile, setEditAttachmentFile] = useState<File | null>(
    null,
  );
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState("UNCHANGED");
  const [bulkFencingCategory, setBulkFencingCategory] = useState<
    FencingCategoryValue | "UNCHANGED" | "NONE"
  >("UNCHANGED");
  const [bulkCompetitionId, setBulkCompetitionId] = useState("UNCHANGED");
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

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

  const loadCompetitions = useCallback(async () => {
    if (!seasonId) {
      setCompetitions([]);
      return;
    }

    setCompetitions(
      await requestJson<Competition[]>(
        `/api/competitions?seasonId=${encodeURIComponent(seasonId)}`,
      ),
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
    if (fencingCategoryFilter !== "all") {
      params.set("fencingCategory", fencingCategoryFilter);
    }
    if (competitionFilter !== "all") {
      params.set("competitionId", competitionFilter);
    }

    const data = await requestJson<Expense[]>(`/api/expenses?${params}`);
    setExpenses(data);
    setSelectedIds((current) => {
      const availableIds = new Set(data.map((expense) => expense.id));
      return new Set([...current].filter((id) => availableIds.has(id)));
    });
  }, [categoryFilter, competitionFilter, fencingCategoryFilter, seasonId]);

  useEffect(() => {
    setCategoryFilter("all");
    setFencingCategoryFilter("all");
    setCompetitionFilter("all");
    setCompetitionId("NONE");
    setSelectedIds(new Set());
    setViewingGroupKey(null);
    setDate(initialDate(currentSeason));
  }, [currentSeason]);

  const selectedExpenseCount = useMemo(
    () => expenses.filter((expense) => selectedIds.has(expense.id)).length,
    [expenses, selectedIds],
  );
  const groupedExpenses = useMemo(() => {
    if (!groupByCompetition) return null;

    const groups = new Map<
      string,
      { competitionName: string; expenses: Expense[]; total: number }
    >();

    for (const expense of expenses) {
      const key = expense.competitionId ?? "NONE";
      const name = expense.competition?.name ?? "Sans compétition";
      const group = groups.get(key) ?? {
        competitionName: name,
        expenses: [],
        total: 0,
      };
      group.expenses.push(expense);
      group.total += Number(expense.amount);
      groups.set(key, group);
    }

    return [...groups.entries()].sort(([keyA, groupA], [keyB, groupB]) => {
      if (keyA === "NONE") return 1;
      if (keyB === "NONE") return -1;
      return groupA.competitionName.localeCompare(groupB.competitionName);
    });
  }, [expenses, groupByCompetition]);
  const allExpensesSelected =
    expenses.length > 0 && selectedExpenseCount === expenses.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedExpenseCount > 0 && !allExpensesSelected;
    }
  }, [allExpensesSelected, selectedExpenseCount]);

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
    void loadCompetitions().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    });
  }, [loadCompetitions]);

  useEffect(() => {
    setError(null);
    void loadExpenses().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    });
  }, [loadExpenses]);

  async function uploadAttachment(expenseId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/expenses/${expenseId}/attachment`, {
      method: "POST",
      body: formData,
    });
    const body = (await response.json().catch(() => null)) as
      | Expense
      | { error?: string }
      | null;

    if (!response.ok) {
      throw new Error(
        body && typeof body === "object" && "error" in body && body.error
          ? body.error
          : "Upload du justificatif impossible",
      );
    }

    return body as Expense;
  }

  async function createExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setMessage(null);
    setWarning(null);

    try {
      const created = await requestJson<{ id: string }>("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          seasonId,
          categoryId,
          fencingCategory:
            fencingCategory === "NONE" ? null : fencingCategory,
          competitionId: competitionId === "NONE" ? null : competitionId,
          amount,
          date,
          description,
        }),
      });
      if (attachmentFile) {
        try {
          await uploadAttachment(created.id, attachmentFile);
        } catch (uploadError) {
          setWarning(
            `Le frais a été créé, mais le justificatif n’a pas pu être ajouté : ${
              uploadError instanceof Error
                ? uploadError.message
                : "upload impossible"
            }`,
          );
        }
      }
      setAmount("");
      setDescription("");
      setAttachmentFile(null);
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = "";
      }
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

  function openEdit(expense: Expense) {
    setEditCategoryId(expense.categoryId);
    setEditFencingCategory(expense.fencingCategory ?? "NONE");
    setEditCompetitionId(expense.competitionId ?? "NONE");
    setEditAmount(expense.amount);
    setEditDate(dateInputValue(new Date(expense.date)));
    setEditDescription(expense.description);
    setEditAttachmentFile(null);
    setEditError(null);
    setEditingExpense(expense);
  }

  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingExpense) {
      return;
    }

    setIsEditSaving(true);
    setEditError(null);
    setWarning(null);

    try {
      let updated = await requestJson<Expense>(
        `/api/expenses/${editingExpense.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            categoryId: editCategoryId,
            fencingCategory:
              editFencingCategory === "NONE" ? null : editFencingCategory,
            competitionId:
              editCompetitionId === "NONE" ? null : editCompetitionId,
            amount: editAmount,
            date: editDate,
            description: editDescription,
          }),
        },
      );
      if (editAttachmentFile) {
        try {
          updated = await uploadAttachment(
            editingExpense.id,
            editAttachmentFile,
          );
        } catch (uploadError) {
          setWarning(
            `La dépense a été modifiée, mais le justificatif n’a pas pu être ajouté : ${
              uploadError instanceof Error
                ? uploadError.message
                : "upload impossible"
            }`,
          );
        }
      }
      setExpenses((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEditingExpense(null);
      onChanged();
    } catch (mutationError) {
      setEditError(
        mutationError instanceof Error
          ? mutationError.message
          : "Modification impossible",
      );
    } finally {
      setIsEditSaving(false);
    }
  }

  async function deleteExpense(expense: Expense) {
    if (!window.confirm("Supprimer définitivement ce frais ?")) {
      return;
    }

    setIsDeletingId(expense.id);
    setError(null);

    try {
      await requestJson(`/api/expenses/${expense.id}`, {
        method: "DELETE",
      });
      setExpenses((current) =>
        current.filter((item) => item.id !== expense.id),
      );
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(expense.id);
        return next;
      });
      onChanged();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Suppression impossible",
      );
    } finally {
      setIsDeletingId(null);
    }
  }

  function toggleExpense(expenseId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(expenseId);
      } else {
        next.delete(expenseId);
      }
      return next;
    });
  }

  function toggleAllExpenses(checked: boolean) {
    setSelectedIds(
      checked ? new Set(expenses.map((expense) => expense.id)) : new Set(),
    );
  }

  function openBulkEdit() {
    setBulkCategoryId("UNCHANGED");
    setBulkFencingCategory("UNCHANGED");
    setBulkCompetitionId("UNCHANGED");
    setBulkError(null);
    setIsBulkEditing(true);
  }

  async function submitBulkEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBulkSaving(true);
    setBulkError(null);

    let failureCount = 0;
    const expensesToUpdate = expenses.filter((expense) =>
      selectedIds.has(expense.id),
    );

    for (const expense of expensesToUpdate) {
      try {
        await requestJson<Expense>(`/api/expenses/${expense.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            categoryId:
              bulkCategoryId === "UNCHANGED"
                ? expense.categoryId
                : bulkCategoryId,
            fencingCategory:
              bulkFencingCategory === "UNCHANGED"
                ? expense.fencingCategory
                : bulkFencingCategory === "NONE"
                  ? null
                  : bulkFencingCategory,
            competitionId:
              bulkCompetitionId === "UNCHANGED"
                ? expense.competitionId
                : bulkCompetitionId === "NONE"
                  ? null
                  : bulkCompetitionId,
            amount: expense.amount,
            date: dateInputValue(new Date(expense.date)),
            description: expense.description,
          }),
        });
      } catch {
        failureCount += 1;
      }
    }

    let reloadError: string | null = null;
    try {
      await loadExpenses();
    } catch (loadError) {
      reloadError =
        loadError instanceof Error
          ? loadError.message
          : "Impossible de recharger les frais";
    } finally {
      onChanged();
      setSelectedIds(new Set());
      setIsBulkEditing(false);
      if (failureCount > 0 || reloadError) {
        const failureSummary =
          failureCount > 0
            ? `${failureCount} frais sur ${expensesToUpdate.length} n’ont pas pu être modifiés.`
            : "";
        setBulkError([failureSummary, reloadError].filter(Boolean).join(" "));
      }
      setIsBulkSaving(false);
    }
  }

  function renderExpenseRow(expense: Expense) {
    return (
      <TableRow key={expense.id}>
        {canManage ? (
          <TableCell>
            <input
              aria-label={`Sélectionner le frais ${expense.description}`}
              checked={selectedIds.has(expense.id)}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              onChange={(event) =>
                toggleExpense(expense.id, event.target.checked)
              }
              type="checkbox"
            />
          </TableCell>
        ) : null}
        <TableCell className="whitespace-nowrap">
          {formatDate(expense.date)}
        </TableCell>
        <TableCell className="min-w-56">
          <button
            className="text-left font-medium text-slate-900 underline-offset-2 hover:underline"
            onClick={() => setDetailExpense(expense)}
            type="button"
          >
            {expense.competition?.name ?? expense.description}
          </button>
          {expense.competition ? (
            <p className="mt-1 line-clamp-1 text-xs text-slate-500">
              {expense.description}
            </p>
          ) : null}
          {expense.attachmentUrl ? (
            <a
              className="mt-1 inline-flex items-center text-xs font-medium text-primary underline-offset-2 hover:underline"
              href={`/api/expenses/${expense.id}/attachment`}
              rel="noreferrer"
              target="_blank"
            >
              <Paperclip className="mr-1 h-3.5 w-3.5" />
              Voir le justificatif
            </a>
          ) : null}
        </TableCell>
        <TableCell>{expense.category.name}</TableCell>
        <TableCell>
          <Badge
            className={
              expense.fencingCategory
                ? fencingCategoryStyles[expense.fencingCategory].badge
                : "border-slate-200 bg-slate-50 text-slate-600"
            }
            variant="outline"
          >
            {expense.fencingCategory
              ? fencingCategoryLabels[expense.fencingCategory]
              : "Non spécifiée"}
          </Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {expense.createdBy.name}
        </TableCell>
        <TableCell className="text-right font-semibold tabular-nums">
          {formatCurrency(expense.amount)}
        </TableCell>
        {canManage ? (
          <TableCell>
            <div className="flex items-center gap-1">
              <Button
                aria-label="Modifier"
                onClick={() => openEdit(expense)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                aria-label="Supprimer"
                disabled={isDeletingId === expense.id}
                onClick={() => void deleteExpense(expense)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        ) : null}
      </TableRow>
    );
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                  <Label htmlFor="expense-category">Catégorie de dépense</Label>
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
                  <Label htmlFor="expense-fencing-category">
                    Catégorie de tireur
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      setFencingCategory(
                        value as FencingCategoryValue | "NONE",
                      )
                    }
                    value={fencingCategory}
                  >
                    <SelectTrigger id="expense-fencing-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Non spécifiée</SelectItem>
                      {fencingCategories.map((value) => (
                        <SelectItem key={value} value={value}>
                          {fencingCategoryLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-competition">
                    Compétition{" "}
                    <span className="font-normal text-slate-400">
                      (facultatif)
                    </span>
                  </Label>
                  <Select onValueChange={setCompetitionId} value={competitionId}>
                    <SelectTrigger id="expense-competition">
                      <SelectValue placeholder="Choisir une compétition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Aucune</SelectItem>
                      {competitions.map((competition) => (
                        <SelectItem key={competition.id} value={competition.id}>
                          {competition.name}
                        </SelectItem>
                      ))}
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

              <div className="space-y-2">
                <Label htmlFor="expense-attachment">
                  Justificatif (facultatif)
                </Label>
                <Input
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  id="expense-attachment"
                  onChange={(event) =>
                    setAttachmentFile(event.target.files?.[0] ?? null)
                  }
                  ref={attachmentInputRef}
                  type="file"
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
              {warning ? (
                <p
                  aria-live="polite"
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                  role="alert"
                >
                  {warning}
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
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-xl">Frais enregistrés</CardTitle>
            <CardDescription>
              Filtrez la saison depuis l’en-tête du module, puis affinez par
              catégorie de dépense, catégorie de tireur ou compétition.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setGroupByCompetition((current) => !current)}
              size="sm"
              type="button"
              variant="outline"
            >
              {groupByCompetition ? "Vue liste" : "Grouper par compétition"}
            </Button>
            <Button asChild size="sm" variant="outline">
              <a
                href={`/api/expenses/export?seasonId=${encodeURIComponent(seasonId)}`}
              >
                <Download className="mr-2 h-4 w-4" />
                Exporter le détail (CSV)
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="expense-category-filter">
                Catégorie de dépense
              </Label>
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
              <Label htmlFor="expense-fencing-category-filter">
                Catégorie de tireur
              </Label>
              <Select
                onValueChange={setFencingCategoryFilter}
                value={fencingCategoryFilter}
              >
                <SelectTrigger id="expense-fencing-category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  <SelectItem value="NONE">Non spécifiée</SelectItem>
                  {fencingCategories.map((value) => (
                    <SelectItem key={value} value={value}>
                      {fencingCategoryLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-competition-filter">Compétition</Label>
              <Select
                onValueChange={setCompetitionFilter}
                value={competitionFilter}
              >
                <SelectTrigger id="expense-competition-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Toutes les compétitions
                  </SelectItem>
                  {competitions.map((competition) => (
                    <SelectItem key={competition.id} value={competition.id}>
                      {competition.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!canManage && error ? (
            <p className="text-sm text-accent-700" role="alert">
              {error}
            </p>
          ) : null}

          {bulkError ? (
            <p
              className="rounded-md border border-accent/20 bg-accent-50 px-3 py-2 text-sm text-accent-700"
              role="alert"
            >
              {bulkError}
            </p>
          ) : null}

          {canManage && selectedExpenseCount > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-700">
                {selectedExpenseCount} sélectionnée(s)
              </span>
              <Button onClick={openBulkEdit} size="sm" type="button">
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </Button>
            </div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                {canManage ? (
                  <TableHead className="w-10">
                    <input
                      aria-label="Sélectionner tous les frais"
                      checked={allExpensesSelected}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      onChange={(event) =>
                        toggleAllExpenses(event.target.checked)
                      }
                      ref={selectAllRef}
                      type="checkbox"
                    />
                  </TableHead>
                ) : null}
                <TableHead>Date</TableHead>
                <TableHead>Détail</TableHead>
                <TableHead>Catégorie de dépense</TableHead>
                <TableHead>Catégorie de tireur</TableHead>
                <TableHead>Saisi par</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                {canManage ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupByCompetition && groupedExpenses
                ? groupedExpenses.map(([key, group]) => (
                    <TableRow
                      className="cursor-pointer bg-slate-50 hover:bg-slate-100"
                      key={key}
                      onClick={() => setViewingGroupKey(key)}
                    >
                      <TableCell className="py-3" colSpan={canManage ? 8 : 6}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-primary underline-offset-2 hover:underline">
                            {group.competitionName}
                          </span>
                          <span className="text-sm text-slate-500">
                            {group.expenses.length} frais ·{" "}
                            {formatCurrency(String(group.total))}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                : expenses.map((expense) => renderExpenseRow(expense))}
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-slate-500"
                    colSpan={canManage ? 8 : 6}
                  >
                    Aucun frais ne correspond à ces filtres.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {viewingGroupKey ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setViewingGroupKey(null)}
        >
          <div
            className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5 shadow-institutional"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-primary">
                  {groupedExpenses?.find(
                    ([key]) => key === viewingGroupKey,
                  )?.[1].competitionName}
                </h2>
                <p className="text-sm text-slate-500">
                  {groupedExpenses?.find(
                    ([key]) => key === viewingGroupKey,
                  )?.[1].expenses.length}{" "}
                  frais ·{" "}
                  {formatCurrency(
                    String(
                      groupedExpenses?.find(
                        ([key]) => key === viewingGroupKey,
                      )?.[1].total ?? 0,
                    ),
                  )}
                </p>
              </div>
              <Button
                aria-label="Fermer"
                onClick={() => setViewingGroupKey(null)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage ? <TableHead className="w-10" /> : null}
                  <TableHead>Date</TableHead>
                  <TableHead>Détail</TableHead>
                  <TableHead>Catégorie de dépense</TableHead>
                  <TableHead>Catégorie de tireur</TableHead>
                  <TableHead>Saisi par</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  {canManage ? <TableHead>Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedExpenses
                  ?.find(([key]) => key === viewingGroupKey)?.[1]
                  .expenses.map((expense) => renderExpenseRow(expense))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {editingExpense ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setEditingExpense(null)}
        >
          <div
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-institutional"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-primary">
                Modifier la dépense
              </h2>
              <Button
                aria-label="Fermer"
                onClick={() => setEditingExpense(null)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="space-y-5" onSubmit={submitEdit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-expense-category">
                    Catégorie de dépense
                  </Label>
                  <Select
                    onValueChange={setEditCategoryId}
                    value={editCategoryId}
                  >
                    <SelectTrigger id="edit-expense-category">
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
                  <Label htmlFor="edit-expense-fencing-category">
                    Catégorie de tireur
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      setEditFencingCategory(
                        value as FencingCategoryValue | "NONE",
                      )
                    }
                    value={editFencingCategory}
                  >
                    <SelectTrigger id="edit-expense-fencing-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Non spécifiée</SelectItem>
                      {fencingCategories.map((value) => (
                        <SelectItem key={value} value={value}>
                          {fencingCategoryLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-expense-competition">
                    Compétition{" "}
                    <span className="font-normal text-slate-400">
                      (facultatif)
                    </span>
                  </Label>
                  <Select
                    onValueChange={setEditCompetitionId}
                    value={editCompetitionId}
                  >
                    <SelectTrigger id="edit-expense-competition">
                      <SelectValue placeholder="Choisir une compétition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Aucune</SelectItem>
                      {competitions.map((competition) => (
                        <SelectItem key={competition.id} value={competition.id}>
                          {competition.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-expense-amount">Montant</Label>
                  <div className="relative">
                    <Input
                      className="pr-9"
                      id="edit-expense-amount"
                      min="0.01"
                      onChange={(event) => setEditAmount(event.target.value)}
                      placeholder="0,00"
                      required
                      step="0.01"
                      type="number"
                      value={editAmount}
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-slate-500">
                      €
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-expense-date">Date</Label>
                <Input
                  id="edit-expense-date"
                  max={currentSeason?.endDate.slice(0, 10)}
                  min={currentSeason?.startDate.slice(0, 10)}
                  onChange={(event) => setEditDate(event.target.value)}
                  required
                  type="date"
                  value={editDate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-expense-description">Description</Label>
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  id="edit-expense-description"
                  maxLength={500}
                  onChange={(event) =>
                    setEditDescription(event.target.value)
                  }
                  placeholder="Détail du frais, personne concernée, trajet…"
                  required
                  value={editDescription}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-expense-attachment">
                  Justificatif (facultatif)
                </Label>
                <Input
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  id="edit-expense-attachment"
                  onChange={(event) =>
                    setEditAttachmentFile(event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
              </div>

              {editError ? (
                <p
                  aria-live="polite"
                  className="rounded-md border border-accent/20 bg-accent-50 px-3 py-2 text-sm text-accent-700"
                  role="alert"
                >
                  {editError}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setEditingExpense(null)}
                  type="button"
                  variant="outline"
                >
                  Annuler
                </Button>
                <Button
                  disabled={isEditSaving || !editCategoryId}
                  type="submit"
                >
                  {isEditSaving
                    ? "Enregistrement…"
                    : "Enregistrer les modifications"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isBulkEditing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => {
            if (!isBulkSaving) {
              setIsBulkEditing(false);
            }
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-institutional"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-primary">
                Modifier les frais sélectionnés
              </h2>
              <Button
                aria-label="Fermer"
                disabled={isBulkSaving}
                onClick={() => setIsBulkEditing(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="space-y-5" onSubmit={submitBulkEdit}>
              <div className="space-y-2">
                <Label htmlFor="bulk-expense-category">
                  Catégorie de dépense
                </Label>
                <Select
                  onValueChange={setBulkCategoryId}
                  value={bulkCategoryId}
                >
                  <SelectTrigger id="bulk-expense-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNCHANGED">Ne pas modifier</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-expense-fencing-category">
                  Catégorie de tireur
                </Label>
                <Select
                  onValueChange={(value) =>
                    setBulkFencingCategory(
                      value as FencingCategoryValue | "UNCHANGED" | "NONE",
                    )
                  }
                  value={bulkFencingCategory}
                >
                  <SelectTrigger id="bulk-expense-fencing-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNCHANGED">Ne pas modifier</SelectItem>
                    <SelectItem value="NONE">Non spécifiée</SelectItem>
                    {fencingCategories.map((value) => (
                      <SelectItem key={value} value={value}>
                        {fencingCategoryLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-expense-competition">Compétition</Label>
                <Select
                  onValueChange={setBulkCompetitionId}
                  value={bulkCompetitionId}
                >
                  <SelectTrigger id="bulk-expense-competition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNCHANGED">Ne pas modifier</SelectItem>
                    <SelectItem value="NONE">Aucune</SelectItem>
                    {competitions.map((competition) => (
                      <SelectItem key={competition.id} value={competition.id}>
                        {competition.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  disabled={isBulkSaving}
                  onClick={() => setIsBulkEditing(false)}
                  type="button"
                  variant="outline"
                >
                  Annuler
                </Button>
                <Button disabled={isBulkSaving} type="submit">
                  {isBulkSaving
                    ? "Application…"
                    : `Appliquer à ${selectedExpenseCount} frais`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailExpense ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setDetailExpense(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-institutional"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-primary">
                Détail de la dépense
              </h2>
              <Button
                aria-label="Fermer"
                onClick={() => setDetailExpense(null)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Date
                </dt>
                <dd>{formatDate(detailExpense.date)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Description
                </dt>
                <dd>{detailExpense.description}</dd>
              </div>
              {detailExpense.competition ? (
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-400">
                    Compétition
                  </dt>
                  <dd>
                    {detailExpense.competition.name}
                    {detailExpense.competition.location
                      ? ` · ${detailExpense.competition.location}`
                      : ""}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Catégorie de dépense
                </dt>
                <dd>{detailExpense.category.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Catégorie de tireur
                </dt>
                <dd>
                  {detailExpense.fencingCategory
                    ? fencingCategoryLabels[detailExpense.fencingCategory]
                    : "Non spécifiée"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Montant
                </dt>
                <dd className="font-semibold">
                  {formatCurrency(detailExpense.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Saisi par
                </dt>
                <dd>{detailExpense.createdBy.name}</dd>
              </div>
              {detailExpense.attachmentUrl ? (
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-400">
                    Justificatif
                  </dt>
                  <dd>
                    <a
                      className="inline-flex items-center font-medium text-primary underline-offset-2 hover:underline"
                      href={`/api/expenses/${detailExpense.id}/attachment`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Paperclip className="mr-1.5 h-4 w-4" />
                      Voir le justificatif
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
