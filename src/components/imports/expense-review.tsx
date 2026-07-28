"use client";

import { Check, Loader2, Save } from "lucide-react";
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

import type { Category, ImportExtractionEnvelope } from "./types";
import {
  asRecord,
  normalizeText,
  requestJson,
  textValue,
} from "./utils";

type ExpenseType = "" | "ACCOMMODATION" | "TRAVEL";

type ExpenseDraft = {
  amount: string;
  date: string;
  type: ExpenseType;
  description: string;
  relatedEvent: string;
  categoryId: string;
  categoryHint: string;
  confidence: string;
  notes: string;
};

type ExpenseReviewProps = {
  batchId: string;
  envelope: ImportExtractionEnvelope;
  onValidated: () => Promise<void>;
};

function importedExpenseType(value: unknown): ExpenseType {
  const normalized = normalizeText(textValue(value));
  if (["hebergement", "accommodation"].includes(normalized)) {
    return "ACCOMMODATION";
  }
  if (["deplacement", "travel"].includes(normalized)) {
    return "TRAVEL";
  }
  return "";
}

function createDraft(value: unknown): ExpenseDraft {
  const row = asRecord(value);
  return {
    amount: textValue(row.amount).replace(",", "."),
    date: textValue(row.date),
    type: importedExpenseType(row.type),
    description: textValue(row.description),
    relatedEvent: textValue(row.relatedEvent),
    categoryId: "",
    categoryHint: textValue(row.category),
    confidence: textValue(row.confidence),
    notes: textValue(row.notes),
  };
}

export function ExpenseReview({
  batchId,
  envelope,
  onValidated,
}: ExpenseReviewProps) {
  const [drafts, setDrafts] = useState<ExpenseDraft[]>(() =>
    envelope.rows.map(createDraft),
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

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
            if (draft.categoryId || !draft.categoryHint) {
              return draft;
            }
            const match = loadedCategories.find(
              (category) =>
                normalizeText(category.name) ===
                normalizeText(draft.categoryHint),
            );
            return match ? { ...draft, categoryId: match.id } : draft;
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
  }, [envelope.seasonId]);

  function updateDraft(index: number, patch: Partial<ExpenseDraft>) {
    setDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    );
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
          !draft.type ||
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
            type: draft.type,
            amount: draft.amount,
            date: draft.date,
            description: draft.description,
            relatedEvent: draft.relatedEvent,
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

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        Vérifiez notamment le montant, la date et la catégorie budgétaire avant
        enregistrement.
      </div>

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
        if (isValidated) {
          return (
            <div
              className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"
              key={index}
            >
              <span className="text-sm font-medium text-emerald-800">
                Ligne {index + 1} · {draft.description || "Dépense"}
              </span>
              <Badge
                className="border-emerald-200 bg-white text-emerald-800"
                variant="outline"
              >
                <Check className="mr-1 h-3 w-3" />
                Enregistrée
              </Badge>
            </div>
          );
        }

        return (
          <div className="space-y-4 rounded-lg border p-4" key={index}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">
                Dépense {index + 1}
              </p>
              <div className="flex flex-wrap gap-2">
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
                <Label htmlFor={`${batchId}-type-${index}`}>Nature</Label>
                <Select
                  onValueChange={(value) =>
                    updateDraft(index, { type: value as ExpenseType })
                  }
                  value={draft.type}
                >
                  <SelectTrigger id={`${batchId}-type-${index}`}>
                    <SelectValue placeholder="Choisir la nature" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACCOMMODATION">Hébergement</SelectItem>
                    <SelectItem value="TRAVEL">Déplacement</SelectItem>
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
              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <Label htmlFor={`${batchId}-event-${index}`}>
                  Événement associé{" "}
                  <span className="font-normal text-slate-400">
                    (facultatif)
                  </span>
                </Label>
                <Input
                  id={`${batchId}-event-${index}`}
                  maxLength={160}
                  onChange={(event) =>
                    updateDraft(index, { relatedEvent: event.target.value })
                  }
                  value={draft.relatedEvent}
                />
              </div>
            </div>

            <div className="flex justify-end">
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

