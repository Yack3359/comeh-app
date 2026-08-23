"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  Category,
  Competition,
  ImportExtractionEnvelope,
  Season,
} from "./types";
import {
  asRecord,
  formatDate,
  normalizeText,
  requestJson,
  textValue,
} from "./utils";

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

type ExpenseDraft = {
  amount: string;
  date: string;
  description: string;
  competitionId: string;
  competitionHint: string;
  categoryId: string;
  categoryHint: string;
  confidence: string;
  notes: string;
};

function createDraft(value: unknown): ExpenseDraft {
  const row = asRecord(value);
  return {
    amount: textValue(row.amount).replace(",", "."),
    date: textValue(row.date),
    description: textValue(row.description),
    competitionId: "NONE",
    competitionHint: textValue(row.relatedEvent),
    categoryId: "",
    categoryHint: textValue(row.category),
    confidence: textValue(row.confidence),
    notes: textValue(row.notes),
  };
}

type ExpenseReviewProps = {
  batchId: string;
  envelope: ImportExtractionEnvelope;
  onValidated: () => Promise<void>;
  seasons: Season[];
};

export function ExpenseReview({
  batchId,
  envelope,
  onValidated,
  seasons,
}: ExpenseReviewProps) {
  const [drafts, setDrafts] = useState<ExpenseDraft[]>(() =>
    envelope.rows.map(createDraft),
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [collapsedIndexes, setCollapsedIndexes] = useState<Set<number>>(
    new Set(),
  );
  const [isChangingSeason, setIsChangingSeason] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [editingValidatedIndex, setEditingValidatedIndex] = useState<
    number | null
  >(null);
  const [validatedEditSnapshot, setValidatedEditSnapshot] =
    useState<ExpenseDraft | null>(null);
  const [isSavingValidatedEdit, setIsSavingValidatedEdit] = useState(false);
  const [deletedValidatedIndexes, setDeletedValidatedIndexes] = useState<
    Set<number>
  >(new Set());

  const validatedIndexes = useMemo(
    () => new Set(envelope.validatedRowIndexes),
    [envelope.validatedRowIndexes],
  );
  const pendingIndexes = drafts
    .map((_, index) => index)
    .filter((index) => !validatedIndexes.has(index));

  useEffect(() => {
    void requestJson<Category[]>(
      `/api/budget-categories?seasonId=${encodeURIComponent(envelope.seasonId)}`,
    )
      .then((loadedCategories) => {
        setCategories(loadedCategories);
        setDrafts((current) =>
          current.map((draft) => {
            if (
              loadedCategories.some(
                (category) => category.id === draft.categoryId,
              )
            ) {
              return draft;
            }
            const match = loadedCategories.find(
              (category) =>
                Boolean(draft.categoryHint) &&
                normalizeText(category.name) ===
                normalizeText(draft.categoryHint),
            );
            return { ...draft, categoryId: match?.id ?? "" };
          }),
        );
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les catégories",
        );
      });

    void requestJson<Competition[]>(
      `/api/competitions?seasonId=${encodeURIComponent(envelope.seasonId)}`,
    )
      .then((loadedCompetitions) => {
        setCompetitions(loadedCompetitions);
        setDrafts((current) =>
          current.map((draft) => {
            if (
              loadedCompetitions.some(
                (competition) => competition.id === draft.competitionId,
              )
            ) {
              return draft;
            }
            if (
              draft.competitionId === "NONE" &&
              !draft.competitionHint
            ) {
              return draft;
            }
            const match = loadedCompetitions.find(
              (competition) =>
                Boolean(draft.competitionHint) &&
                normalizeText(competition.name) ===
                normalizeText(draft.competitionHint),
            );
            return { ...draft, competitionId: match?.id ?? "NONE" };
          }),
        );
      })
      .catch(() => {
        setCompetitions([]);
      });
  }, [envelope.seasonId]);

  function updateDraft(index: number, patch: Partial<ExpenseDraft>) {
    setDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function toggleCollapsed(index: number) {
    setCollapsedIndexes((current) => {
      const updated = new Set(current);
      if (updated.has(index)) {
        updated.delete(index);
      } else {
        updated.add(index);
      }
      return updated;
    });
  }

  function summary(draft: ExpenseDraft) {
    const amount = Number(draft.amount);
    const parts = [
      draft.amount && Number.isFinite(amount)
        ? euroFormatter.format(amount)
        : undefined,
      draft.date && !Number.isNaN(new Date(draft.date).getTime())
        ? formatDate(draft.date)
        : undefined,
      categories.find((category) => category.id === draft.categoryId)?.name,
      competitions.find(
        (competition) => competition.id === draft.competitionId,
      )?.name,
    ].filter((value): value is string => Boolean(value));

    return parts.join(" · ") || draft.description || "Dépense";
  }

  async function changeSeason(seasonId: string) {
    if (seasonId === envelope.seasonId) {
      return;
    }

    setError(null);
    setIsChangingSeason(true);
    try {
      await requestJson(`/api/imports/${batchId}/season`, {
        method: "PATCH",
        body: JSON.stringify({ seasonId }),
      });
      await onValidated();
    } catch (seasonError) {
      setError(
        seasonError instanceof Error
          ? seasonError.message
          : "Impossible de changer la saison",
      );
    } finally {
      setIsChangingSeason(false);
    }
  }

  async function validate(indexes: number[]) {
    setError(null);

    try {
      const rows = indexes.map((index) => {
        const draft = drafts[index];
        if (!draft) {
          throw new Error(`La ligne ${index + 1} est introuvable`);
        }
        if (
          !draft.amount ||
          !draft.date ||
          !draft.description.trim() ||
          !draft.categoryId
        ) {
          throw new Error(
            `Complétez les champs obligatoires de la ligne ${index + 1}.`,
          );
        }

        return {
          index,
          data: {
            seasonId: envelope.seasonId,
            categoryId: draft.categoryId,
            competitionId:
              draft.competitionId === "NONE" ? null : draft.competitionId,
            amount: draft.amount,
            date: draft.date,
            description: draft.description,
          },
        };
      });

      setIsValidating(true);
      await requestJson(`/api/imports/${batchId}/validate`, {
        method: "POST",
        body: JSON.stringify({ target: "expense", rows }),
      });
      await onValidated();
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "La validation a échoué",
      );
    } finally {
      setIsValidating(false);
    }
  }

  async function saveValidatedEdit(index: number) {
    setError(null);

    const draft = drafts[index];
    const recordId = envelope.createdEntityIds?.[String(index)];
    if (!draft || !recordId) {
      setError(`La dépense de la ligne ${index + 1} est introuvable.`);
      return;
    }
    if (
      !draft.amount ||
      !draft.date ||
      !draft.description.trim() ||
      !draft.categoryId
    ) {
      setError(`Complétez les champs obligatoires de la ligne ${index + 1}.`);
      return;
    }

    setIsSavingValidatedEdit(true);
    try {
      await requestJson(`/api/expenses/${recordId}`, {
        method: "PATCH",
        body: JSON.stringify({
          categoryId: draft.categoryId,
          competitionId:
            draft.competitionId === "NONE" ? null : draft.competitionId,
          amount: draft.amount,
          date: draft.date,
          description: draft.description,
        }),
      });
      setEditingValidatedIndex(null);
      setValidatedEditSnapshot(null);
      await onValidated();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible de modifier la dépense",
      );
    } finally {
      setIsSavingValidatedEdit(false);
    }
  }

  async function deleteValidatedExpense(index: number, recordId: string) {
    if (!window.confirm("Supprimer définitivement cette dépense ?")) {
      return;
    }

    setError(null);
    try {
      await requestJson(`/api/expenses/${recordId}`, { method: "DELETE" });
      setDeletedValidatedIndexes((current) => {
        const updated = new Set(current);
        updated.add(index);
        return updated;
      });
      await onValidated();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Impossible de supprimer la dépense",
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        Vérifiez notamment le montant, la date et la catégorie budgétaire avant
        enregistrement.
      </div>

      {envelope.validatedRowIndexes.length === 0 ? (
        <div className="max-w-sm space-y-2">
          <Label htmlFor={`${batchId}-season`}>Saison de cet import</Label>
          <Select
            disabled={isChangingSeason}
            onValueChange={(value) => void changeSeason(value)}
            value={envelope.seasonId}
          >
            <SelectTrigger id={`${batchId}-season`}>
              <SelectValue placeholder="Choisir une saison" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((season) => (
                <SelectItem key={season.id} value={season.id}>
                  {season.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isChangingSeason ? (
            <p className="flex items-center text-xs text-slate-500">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Changement de saison…
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium">
            Saison de cet import :{" "}
            {seasons.find((season) => season.id === envelope.seasonId)?.label ??
              envelope.seasonId}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            La saison ne peut plus être modifiée car des lignes ont déjà été
            validées.
          </p>
        </div>
      )}

      {error ? (
        <p
          className="rounded-md border border-accent/20 bg-accent-50 p-3 text-sm text-accent-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {drafts.map((draft, index) => {
        const isValidated = validatedIndexes.has(index);
        const isDeleted = deletedValidatedIndexes.has(index);
        const isEditingValidated = editingValidatedIndex === index;
        const recordId = envelope.createdEntityIds?.[String(index)];

        if (isValidated && !isEditingValidated) {
          return (
            <div
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                isDeleted
                  ? "border-slate-200 bg-slate-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
              key={index}
            >
              <span
                className={`min-w-0 text-sm font-medium ${
                  isDeleted
                    ? "text-slate-500 line-through"
                    : "text-emerald-800"
                }`}
              >
                Ligne {index + 1} · {summary(draft)}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  className={
                    isDeleted
                      ? "border-slate-200 bg-white text-slate-600"
                      : "border-emerald-200 bg-white text-emerald-800"
                  }
                  variant="outline"
                >
                  {isDeleted ? null : <Check className="mr-1 h-3 w-3" />}
                  {isDeleted ? "Supprimée" : "Enregistrée"}
                </Badge>
                {!isDeleted && recordId ? (
                  <>
                    <Button
                      aria-label="Modifier"
                      className="h-8 w-8"
                      onClick={() => {
                        setValidatedEditSnapshot({ ...draft });
                        setEditingValidatedIndex(index);
                      }}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label="Supprimer"
                      className="h-8 w-8 text-accent-600 hover:text-accent-700"
                      onClick={() =>
                        void deleteValidatedExpense(index, recordId)
                      }
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          );
        }

        const isCollapsed = collapsedIndexes.has(index);
        if (!isValidated && isCollapsed) {
          return (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 px-4 py-3"
              key={index}
            >
              <span className="min-w-0 truncate text-sm font-medium text-slate-700">
                Ligne {index + 1} · {summary(draft)}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">À relire</Badge>
                <Button
                  aria-label={`Réouvrir la dépense ${index + 1}`}
                  className="h-8 w-8"
                  onClick={() => toggleCollapsed(index)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-4 rounded-lg border p-4" key={index}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">
                Dépense {index + 1}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {draft.confidence ? (
                  <Badge variant="outline">
                    Confiance : {draft.confidence}
                  </Badge>
                ) : null}
                {draft.categoryHint ? (
                  <Badge variant="secondary">
                    Catégorie détectée : {draft.categoryHint}
                  </Badge>
                ) : null}
                {!isValidated ? (
                  <Button
                    aria-label={`Réduire la dépense ${index + 1}`}
                    className="h-8 w-8"
                    onClick={() => toggleCollapsed(index)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>

            {draft.notes ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Point à vérifier : {draft.notes}
              </p>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`${batchId}-amount-${index}`}>Montant (€)</Label>
                <Input
                  id={`${batchId}-amount-${index}`}
                  inputMode="decimal"
                  onChange={(event) =>
                    updateDraft(index, { amount: event.target.value })
                  }
                  required
                  value={draft.amount}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${batchId}-date-${index}`}>Date</Label>
                <Input
                  id={`${batchId}-date-${index}`}
                  onChange={(event) =>
                    updateDraft(index, { date: event.target.value })
                  }
                  required
                  type="date"
                  value={draft.date}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${batchId}-competition-${index}`}>
                  Compétition{" "}
                  <span className="font-normal text-slate-400">
                    (facultatif)
                  </span>
                </Label>
                <Select
                  onValueChange={(value) =>
                    updateDraft(index, { competitionId: value })
                  }
                  value={draft.competitionId}
                >
                  <SelectTrigger id={`${batchId}-competition-${index}`}>
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
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`${batchId}-description-${index}`}>
                  Description
                </Label>
                <Input
                  id={`${batchId}-description-${index}`}
                  maxLength={500}
                  onChange={(event) =>
                    updateDraft(index, { description: event.target.value })
                  }
                  required
                  value={draft.description}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${batchId}-category-${index}`}>
                  Catégorie budgétaire
                </Label>
                <Select
                  onValueChange={(value) =>
                    updateDraft(index, { categoryId: value })
                  }
                  value={draft.categoryId}
                >
                  <SelectTrigger id={`${batchId}-category-${index}`}>
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
            </div>

            <div className="flex justify-end gap-2">
              {isValidated ? (
                <>
                  <Button
                    disabled={isSavingValidatedEdit}
                    onClick={() => {
                      if (validatedEditSnapshot) {
                        setDrafts((current) =>
                          current.map((currentDraft, draftIndex) =>
                            draftIndex === index
                              ? validatedEditSnapshot
                              : currentDraft,
                          ),
                        );
                      }
                      setEditingValidatedIndex(null);
                      setValidatedEditSnapshot(null);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Annuler
                  </Button>
                  <Button
                    disabled={isSavingValidatedEdit}
                    onClick={() => void saveValidatedEdit(index)}
                    size="sm"
                    type="button"
                  >
                    {isSavingValidatedEdit ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Enregistrer les modifications
                  </Button>
                </>
              ) : (
                <Button
                  disabled={isValidating}
                  onClick={() => void validate([index])}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Valider cette ligne
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {pendingIndexes.length > 1 ? (
        <div className="flex justify-end">
          <Button
            disabled={isValidating}
            onClick={() => void validate(pendingIndexes)}
            type="button"
          >
            {isValidating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Tout valider ({pendingIndexes.length})
          </Button>
        </div>
      ) : null}
    </div>
  );
}

