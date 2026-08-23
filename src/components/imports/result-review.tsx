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
  Athlete,
  Competition,
  ImportExtractionEnvelope,
  Season,
} from "./types";
import {
  asRecord,
  normalizeText,
  requestJson,
  textValue,
} from "./utils";

type ResultKind = "ranking" | "bout";
type WonValue = "" | "true" | "false";

type ResultDraft = {
  type: ResultKind;
  competitionId: string;
  athleteId: string;
  opponentAthleteId: string;
  rank: string;
  seedRank: string;
  poolRank: string;
  won: WonValue;
  scoreFor: string;
  scoreAgainst: string;
  round: string;
  athleteHint: string;
  opponentHint: string;
  competitionHint: string;
  dateHint: string;
  confidence: string;
  notes: string;
};

type ResultReviewProps = {
  batchId: string;
  envelope: ImportExtractionEnvelope;
  onValidated: () => Promise<void>;
  seasons: Season[];
};

function importedWon(value: unknown): WonValue {
  const normalized = normalizeText(textValue(value));
  if (
    ["true", "oui", "victoire", "v", "gagne", "gagnant", "1"].includes(
      normalized,
    )
  ) {
    return "true";
  }
  if (
    ["false", "non", "defaite", "d", "perdu", "perdant", "0"].includes(
      normalized,
    )
  ) {
    return "false";
  }
  return "";
}

function createDraft(value: unknown): ResultDraft {
  const row = asRecord(value);
  const opponentHint = textValue(row.opponentName);
  const won = importedWon(row.won);

  return {
    type: opponentHint || textValue(row.won) ? "bout" : "ranking",
    competitionId: "",
    athleteId: "",
    opponentAthleteId: "",
    rank: textValue(row.rank),
    seedRank: textValue(row.seedRank),
    poolRank: textValue(row.poolRank),
    won,
    scoreFor: textValue(row.scoreFor),
    scoreAgainst: textValue(row.scoreAgainst),
    round: textValue(row.round),
    athleteHint: textValue(row.athleteName),
    opponentHint,
    competitionHint: textValue(row.competitionName),
    dateHint: textValue(row.date),
    confidence: textValue(row.confidence),
    notes: textValue(row.notes),
  };
}

function athleteLabel(athlete: Athlete) {
  return `${athlete.firstName} ${athlete.lastName}`;
}

function matchesAthlete(athlete: Athlete, hint: string) {
  const normalizedHint = normalizeText(hint);
  return (
    normalizeText(athleteLabel(athlete)) === normalizedHint ||
    normalizeText(`${athlete.lastName} ${athlete.firstName}`) ===
      normalizedHint
  );
}

export function ResultReview({
  batchId,
  envelope,
  onValidated,
  seasons,
}: ResultReviewProps) {
  const [drafts, setDrafts] = useState<ResultDraft[]>(() =>
    envelope.rows.map(createDraft),
  );
  const [athletes, setAthletes] = useState<Athlete[]>([]);
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
    useState<ResultDraft | null>(null);
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
    void Promise.all([
      requestJson<Athlete[]>("/api/athletes"),
      requestJson<Competition[]>(
        `/api/competitions?seasonId=${encodeURIComponent(envelope.seasonId)}`,
      ),
    ])
      .then(([loadedAthletes, loadedCompetitions]) => {
        setAthletes(loadedAthletes);
        setCompetitions(loadedCompetitions);
        setDrafts((current) =>
          current.map((draft) => {
            const athlete = draft.athleteHint
              ? loadedAthletes.find((item) =>
                  matchesAthlete(item, draft.athleteHint),
                )
              : undefined;
            const opponent = draft.opponentHint
              ? loadedAthletes.find((item) =>
                  matchesAthlete(item, draft.opponentHint),
                )
              : undefined;
            const selectedCompetition = loadedCompetitions.find(
              (item) => item.id === draft.competitionId,
            );
            const competition =
              selectedCompetition ??
              loadedCompetitions.find((item) => {
                if (
                  draft.competitionHint &&
                  normalizeText(item.name) ===
                    normalizeText(draft.competitionHint)
                ) {
                  return true;
                }
                return (
                  !draft.competitionHint &&
                  Boolean(draft.dateHint) &&
                  item.date.slice(0, 10) === draft.dateHint.slice(0, 10)
                );
              });

            return {
              ...draft,
              athleteId: draft.athleteId || athlete?.id || "",
              opponentAthleteId:
                draft.opponentAthleteId || opponent?.id || "",
              competitionId:
                competition?.id || "",
            };
          }),
        );
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les référentiels sportifs",
        );
      });
  }, [envelope.seasonId]);

  function updateDraft(index: number, patch: Partial<ResultDraft>) {
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

  function summary(draft: ResultDraft) {
    const athlete = athletes.find((item) => item.id === draft.athleteId);
    const competition = competitions.find(
      (item) => item.id === draft.competitionId,
    );
    const score = [draft.scoreFor, draft.scoreAgainst].some(Boolean)
      ? [draft.scoreFor || "?", draft.scoreAgainst || "?"].join("–")
      : "";
    const result =
      draft.type === "ranking"
        ? draft.rank
          ? `Rang ${draft.rank}`
          : "Classement"
        : [
            draft.won === "true"
              ? "Victoire"
              : draft.won === "false"
                ? "Défaite"
                : "Assaut",
            score,
          ]
            .filter(Boolean)
            .join(" ");

    return [
      athlete ? athleteLabel(athlete) : draft.athleteHint || "Athlète",
      competition?.name || draft.competitionHint,
      result,
    ]
      .filter(Boolean)
      .join(" · ");
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
        if (!draft.competitionId || !draft.athleteId) {
          throw new Error(
            `Choisissez la compétition et l’athlète de la ligne ${index + 1}.`,
          );
        }

        if (draft.type === "bout") {
          if (!draft.opponentAthleteId || !draft.won) {
            throw new Error(
              `Choisissez l’adversaire et l’issue de la ligne ${index + 1}.`,
            );
          }
          return {
            index,
            data: {
              type: "bout",
              competitionId: draft.competitionId,
              participantType: "athlete",
              athleteId: draft.athleteId,
              opponentAthleteId: draft.opponentAthleteId,
              won: draft.won === "true",
              scoreFor: draft.scoreFor || null,
              scoreAgainst: draft.scoreAgainst || null,
              round: draft.round,
            },
          };
        }

        if (!draft.rank) {
          throw new Error(
            `Indiquez le rang de classement de la ligne ${index + 1}.`,
          );
        }
        return {
          index,
          data: {
            type: "ranking",
            competitionId: draft.competitionId,
            participantType: "athlete",
            athleteId: draft.athleteId,
            teamId: null,
            rank: draft.rank,
            seedRank: draft.seedRank || null,
            poolRank: draft.poolRank || null,
          },
        };
      });

      setIsValidating(true);
      await requestJson(`/api/imports/${batchId}/validate`, {
        method: "POST",
        body: JSON.stringify({ target: "result", rows }),
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
      setError(`Le résultat de la ligne ${index + 1} est introuvable.`);
      return;
    }
    if (!draft.competitionId || !draft.athleteId) {
      setError(
        `Choisissez la compétition et l’athlète de la ligne ${index + 1}.`,
      );
      return;
    }

    let data;
    if (draft.type === "bout") {
      if (!draft.opponentAthleteId || !draft.won) {
        setError(
          `Choisissez l’adversaire et l’issue de la ligne ${index + 1}.`,
        );
        return;
      }
      data = {
        type: "bout" as const,
        competitionId: draft.competitionId,
        participantType: "athlete" as const,
        athleteId: draft.athleteId,
        opponentAthleteId: draft.opponentAthleteId,
        won: draft.won === "true",
        scoreFor: draft.scoreFor || null,
        scoreAgainst: draft.scoreAgainst || null,
        round: draft.round,
      };
    } else {
      if (!draft.rank) {
        setError(`Indiquez le rang de classement de la ligne ${index + 1}.`);
        return;
      }
      data = {
        type: "ranking" as const,
        competitionId: draft.competitionId,
        participantType: "athlete" as const,
        athleteId: draft.athleteId,
        teamId: null,
        rank: draft.rank,
        seedRank: draft.seedRank || null,
        poolRank: draft.poolRank || null,
      };
    }

    setIsSavingValidatedEdit(true);
    try {
      await requestJson(`/api/results/${recordId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setEditingValidatedIndex(null);
      setValidatedEditSnapshot(null);
      await onValidated();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible de modifier le résultat",
      );
    } finally {
      setIsSavingValidatedEdit(false);
    }
  }

  async function deleteValidatedResult(index: number, recordId: string) {
    if (!window.confirm("Supprimer définitivement ce résultat ?")) {
      return;
    }

    setError(null);
    try {
      await requestJson(`/api/results/${recordId}`, { method: "DELETE" });
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
          : "Impossible de supprimer le résultat",
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        Rattachez chaque ligne aux athlètes et compétitions existants. Les noms
        reconnus exactement sont présélectionnés.
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

      {competitions.length === 0 ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Aucune compétition n’existe pour cette saison. Créez-la d’abord dans
          le module Rankings.
        </p>
      ) : null}

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
                      onClick={() => void deleteValidatedResult(index, recordId)}
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
                  aria-label={`Réouvrir le résultat ${index + 1}`}
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
                Résultat {index + 1}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {draft.confidence ? (
                  <Badge variant="outline">
                    Confiance : {draft.confidence}
                  </Badge>
                ) : null}
                {draft.dateHint ? (
                  <Badge variant="secondary">Date lue : {draft.dateHint}</Badge>
                ) : null}
                {!isValidated ? (
                  <Button
                    aria-label={`Réduire le résultat ${index + 1}`}
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

            <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Extrait :{" "}
              {[
                draft.athleteHint,
                draft.opponentHint
                  ? `vs ${draft.opponentHint}`
                  : undefined,
                draft.competitionHint,
              ]
                .filter(Boolean)
                .join(" · ") || "aucun nom reconnu"}
            </div>

            {draft.notes ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Point à vérifier : {draft.notes}
              </p>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`${batchId}-result-type-${index}`}>
                  Type de résultat
                </Label>
                <Select
                  onValueChange={(value) =>
                    updateDraft(index, { type: value as ResultKind })
                  }
                  value={draft.type}
                >
                  <SelectTrigger id={`${batchId}-result-type-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ranking">Classement final</SelectItem>
                    <SelectItem value="bout">Assaut individuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`${batchId}-competition-${index}`}>
                  Compétition
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
                    {competitions.map((competition) => (
                      <SelectItem
                        key={competition.id}
                        value={competition.id}
                      >
                        {competition.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${batchId}-athlete-${index}`}>Athlète</Label>
                <Select
                  onValueChange={(value) =>
                    updateDraft(index, { athleteId: value })
                  }
                  value={draft.athleteId}
                >
                  <SelectTrigger id={`${batchId}-athlete-${index}`}>
                    <SelectValue placeholder="Choisir un athlète" />
                  </SelectTrigger>
                  <SelectContent>
                    {athletes.map((athlete) => (
                      <SelectItem key={athlete.id} value={athlete.id}>
                        {athleteLabel(athlete)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {draft.type === "bout" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor={`${batchId}-opponent-${index}`}>
                      Adversaire
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        updateDraft(index, { opponentAthleteId: value })
                      }
                      value={draft.opponentAthleteId}
                    >
                      <SelectTrigger id={`${batchId}-opponent-${index}`}>
                        <SelectValue placeholder="Choisir l’adversaire" />
                      </SelectTrigger>
                      <SelectContent>
                        {athletes.map((athlete) => (
                          <SelectItem key={athlete.id} value={athlete.id}>
                            {athleteLabel(athlete)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${batchId}-won-${index}`}>Issue</Label>
                    <Select
                      onValueChange={(value) =>
                        updateDraft(index, { won: value as WonValue })
                      }
                      value={draft.won}
                    >
                      <SelectTrigger id={`${batchId}-won-${index}`}>
                        <SelectValue placeholder="Choisir l’issue" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Victoire</SelectItem>
                        <SelectItem value="false">Défaite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor={`${batchId}-rank-${index}`}>
                    Classement final
                  </Label>
                  <Input
                    id={`${batchId}-rank-${index}`}
                    min={1}
                    onChange={(event) =>
                      updateDraft(index, { rank: event.target.value })
                    }
                    required
                    type="number"
                    value={draft.rank}
                  />
                </div>
              )}

              {draft.type === "bout" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor={`${batchId}-score-for-${index}`}>
                      Score tireur{" "}
                      <span className="font-normal text-slate-400">
                        (facultatif)
                      </span>
                    </Label>
                    <Input
                      id={`${batchId}-score-for-${index}`}
                      min={0}
                      onChange={(event) =>
                        updateDraft(index, { scoreFor: event.target.value })
                      }
                      type="number"
                      value={draft.scoreFor}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${batchId}-score-against-${index}`}>
                      Score adversaire{" "}
                      <span className="font-normal text-slate-400">
                        (facultatif)
                      </span>
                    </Label>
                    <Input
                      id={`${batchId}-score-against-${index}`}
                      min={0}
                      onChange={(event) =>
                        updateDraft(index, {
                          scoreAgainst: event.target.value,
                        })
                      }
                      type="number"
                      value={draft.scoreAgainst}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor={`${batchId}-seed-rank-${index}`}>
                      Classement initial{" "}
                      <span className="font-normal text-slate-400">
                        (facultatif)
                      </span>
                    </Label>
                    <Input
                      id={`${batchId}-seed-rank-${index}`}
                      min={1}
                      onChange={(event) =>
                        updateDraft(index, { seedRank: event.target.value })
                      }
                      type="number"
                      value={draft.seedRank}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${batchId}-pool-rank-${index}`}>
                      Classement poule{" "}
                      <span className="font-normal text-slate-400">
                        (facultatif)
                      </span>
                    </Label>
                    <Input
                      id={`${batchId}-pool-rank-${index}`}
                      min={1}
                      onChange={(event) =>
                        updateDraft(index, { poolRank: event.target.value })
                      }
                      type="number"
                      value={draft.poolRank}
                    />
                  </div>
                </>
              )}
              {draft.type === "bout" ? (
                <div className="space-y-2">
                  <Label htmlFor={`${batchId}-round-${index}`}>
                    Tour{" "}
                    <span className="font-normal text-slate-400">
                      (facultatif)
                    </span>
                  </Label>
                  <Input
                    id={`${batchId}-round-${index}`}
                    maxLength={80}
                    onChange={(event) =>
                      updateDraft(index, { round: event.target.value })
                    }
                    value={draft.round}
                  />
                </div>
              ) : null}
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
