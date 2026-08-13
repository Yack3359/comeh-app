"use client";

import { Pencil, PlusCircle, Save, Trash2, X } from "lucide-react";
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

import type {
  Athlete,
  Competition,
  CompetitionFilters,
  RankingResult,
  Team,
} from "./types";
import {
  appendCompetitionFilters,
  competitionMatchesFilters,
  CompetitionFilterPanel,
  defaultCompetitionFilters,
} from "./competition-filters";
import { athleteName, formatDate, requestJson } from "./utils";

type ResultManagerProps = {
  seasonId: string;
  canManage: boolean;
  version: number;
  onChanged: () => void;
};

type ResultForm = {
  type: "ranking" | "bout";
  participantType: "athlete" | "team";
  competitionId: string;
  athleteId: string;
  teamId: string;
  opponentAthleteId: string;
  opponentTeamName: string;
  rank: string;
  seedRank: string;
  poolRank: string;
  won: "true" | "false";
  scoreFor: string;
  scoreAgainst: string;
  round: string;
  observations: string;
};

const emptyForm: ResultForm = {
  type: "ranking",
  participantType: "athlete",
  competitionId: "",
  athleteId: "",
  teamId: "",
  opponentAthleteId: "",
  opponentTeamName: "",
  rank: "1",
  seedRank: "",
  poolRank: "",
  won: "true",
  scoreFor: "",
  scoreAgainst: "",
  round: "",
  observations: "",
};

function resultLabel(result: RankingResult) {
  if (result.type === "ranking") {
    return `${result.rank}${result.rank === 1 ? "er" : "e"}`;
  }
  return result.won ? "Victoire" : "Défaite";
}

function opponentLabel(result: RankingResult) {
  if (result.opponentAthlete) {
    return athleteName(result.opponentAthlete);
  }
  return result.opponentTeamName ?? null;
}

export function ResultManager({
  seasonId,
  canManage,
  version,
  onChanged,
}: ResultManagerProps) {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [results, setResults] = useState<RankingResult[]>([]);
  const [filters, setFilters] = useState<CompetitionFilters>(
    defaultCompetitionFilters,
  );
  const [form, setForm] = useState<ResultForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!seasonId) {
      setTeams([]);
      setCompetitions([]);
      setResults([]);
      return;
    }

    const resultParams = appendCompetitionFilters(
      new URLSearchParams({ seasonId }),
      filters,
    );
    const [athleteData, teamData, competitionData, resultData] =
      await Promise.all([
        requestJson<Athlete[]>("/api/athletes"),
        requestJson<Team[]>(`/api/teams?seasonId=${encodeURIComponent(seasonId)}`),
        requestJson<Competition[]>(
          `/api/competitions?seasonId=${encodeURIComponent(seasonId)}`,
        ),
        requestJson<RankingResult[]>(
          `/api/results?${resultParams}`,
        ),
      ]);

    const eligibleCompetitions = competitionData.filter((competition) =>
      competitionMatchesFilters(competition, filters),
    );
    setAthletes(athleteData);
    setTeams(teamData);
    setCompetitions(competitionData);
    setResults(resultData);
    setForm((current) => ({
      ...current,
      competitionId:
        eligibleCompetitions.some((item) => item.id === current.competitionId)
          ? current.competitionId
          : (eligibleCompetitions[0]?.id ?? ""),
      athleteId:
        athleteData.some((item) => item.id === current.athleteId)
          ? current.athleteId
          : (athleteData[0]?.id ?? ""),
      teamId:
        teamData.some((item) => item.id === current.teamId)
          ? current.teamId
          : (teamData[0]?.id ?? ""),
    }));
  }, [filters, seasonId]);

  useEffect(() => {
    setError(null);
    void loadData().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    });
  }, [loadData, version]);

  useEffect(() => {
    setEditingId(null);
    setForm(emptyForm);
  }, [seasonId]);

  useEffect(() => {
    setForm((current) => {
      if (
        current.opponentAthleteId &&
        current.opponentAthleteId !== current.athleteId
      ) {
        return current;
      }
      return {
        ...current,
        opponentAthleteId:
          athletes.find((athlete) => athlete.id !== current.athleteId)?.id ?? "",
      };
    });
  }, [athletes, form.athleteId]);

  const opponentOptions = useMemo(
    () => athletes.filter((athlete) => athlete.id !== form.athleteId),
    [athletes, form.athleteId],
  );
  const visibleCompetitions = useMemo(
    () =>
      competitions.filter((competition) =>
        competitionMatchesFilters(competition, filters),
      ),
    [competitions, filters],
  );

  function resetForm() {
    setEditingId(null);
    setForm((current) => ({
      ...emptyForm,
      competitionId: visibleCompetitions[0]?.id ?? "",
      athleteId: athletes[0]?.id ?? "",
      opponentAthleteId:
        athletes.find((athlete) => athlete.id !== athletes[0]?.id)?.id ?? "",
      teamId: teams[0]?.id ?? "",
    }));
  }

  async function saveResult(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setMessage(null);

    const base = {
      competitionId: form.competitionId,
      participantType: form.participantType,
      athleteId: form.participantType === "athlete" ? form.athleteId : null,
      teamId: form.participantType === "team" ? form.teamId : null,
      observations: form.observations,
    };

    const body =
      form.type === "bout"
        ? {
            ...base,
            type: "bout",
            opponentAthleteId:
              form.participantType === "athlete" ? form.opponentAthleteId : null,
            opponentTeamName:
              form.participantType === "team" ? form.opponentTeamName : null,
            won: form.won === "true",
            scoreFor: form.scoreFor || null,
            scoreAgainst: form.scoreAgainst || null,
            round: form.round,
          }
        : {
            ...base,
            type: "ranking",
            rank: form.rank,
            seedRank: form.seedRank || null,
            poolRank: form.poolRank || null,
          };

    try {
      await requestJson(editingId ? `/api/results/${editingId}` : "/api/results", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setMessage(editingId ? "Résultat mis à jour." : "Résultat enregistré.");
      resetForm();
      await loadData();
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

  function startEditing(result: RankingResult) {
    setEditingId(result.id);
    setForm({
      type: result.type,
      participantType: result.participantType,
      competitionId: result.competitionId,
      athleteId: result.athleteId ?? athletes[0]?.id ?? "",
      teamId: result.teamId ?? teams[0]?.id ?? "",
      opponentAthleteId: result.opponentAthleteId ?? "",
      opponentTeamName: result.opponentTeamName ?? "",
      rank: String(result.rank ?? 1),
      seedRank: result.seedRank ? String(result.seedRank) : "",
      poolRank: result.poolRank ? String(result.poolRank) : "",
      won: result.won === false ? "false" : "true",
      scoreFor: result.scoreFor !== null ? String(result.scoreFor) : "",
      scoreAgainst:
        result.scoreAgainst !== null ? String(result.scoreAgainst) : "",
      round: result.round ?? "",
      observations: result.observations ?? "",
    });
  }

  async function deleteResult(result: RankingResult) {
    if (!window.confirm("Supprimer ce résultat ?")) {
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      await requestJson(`/api/results/${result.id}`, { method: "DELETE" });
      await loadData();
      onChanged();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Suppression impossible",
      );
    } finally {
      setIsPending(false);
    }
  }

  const canSubmit =
    Boolean(form.competitionId) &&
    (form.participantType === "athlete" ? Boolean(form.athleteId) : Boolean(form.teamId)) &&
    (form.type !== "bout" ||
      (form.participantType === "athlete"
        ? Boolean(form.opponentAthleteId)
        : Boolean(form.opponentTeamName.trim())));

  return (
    <div className="space-y-5">
      <CompetitionFilterPanel
        filters={filters}
        idPrefix="results-filter"
        onChange={setFilters}
      />
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {editingId ? "Modifier le résultat" : "Saisir un résultat"}
            </CardTitle>
            <CardDescription>
              Enregistrez soit un classement (final, initial, poule), soit un
              résultat unitaire de poule ou de tableau face à un adversaire.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveResult}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="result-type">Type</Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        type: value as ResultForm["type"],
                      }))
                    }
                    value={form.type}
                  >
                    <SelectTrigger id="result-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ranking">Classement</SelectItem>
                      <SelectItem value="bout">Résultat poule / tableau</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="result-competition">Compétition</Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        competitionId: value,
                      }))
                    }
                    value={form.competitionId}
                  >
                    <SelectTrigger id="result-competition">
                      <SelectValue placeholder="Choisir une compétition" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleCompetitions.map((competition) => (
                        <SelectItem key={competition.id} value={competition.id}>
                          {competition.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="result-participant-type">Participant</Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        participantType:
                          value as ResultForm["participantType"],
                      }))
                    }
                    value={form.participantType}
                  >
                    <SelectTrigger id="result-participant-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="athlete">Athlète</SelectItem>
                      <SelectItem value="team">Équipe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.participantType === "athlete" ? (
                  <div className="space-y-2">
                    <Label htmlFor="result-athlete">Athlète</Label>
                    <Select
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          athleteId: value,
                        }))
                      }
                      value={form.athleteId}
                    >
                      <SelectTrigger id="result-athlete">
                        <SelectValue placeholder="Choisir un athlète" />
                      </SelectTrigger>
                      <SelectContent>
                        {athletes.map((athlete) => (
                          <SelectItem key={athlete.id} value={athlete.id}>
                            {athleteName(athlete)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="result-team">Équipe</Label>
                    <Select
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          teamId: value,
                        }))
                      }
                      value={form.teamId}
                    >
                      <SelectTrigger id="result-team">
                        <SelectValue placeholder="Choisir une équipe" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {form.type === "bout" ? (
                  <>
                    {form.participantType === "athlete" ? (
                      <div className="space-y-2">
                        <Label htmlFor="result-opponent">Adversaire</Label>
                        <Select
                          onValueChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              opponentAthleteId: value,
                            }))
                          }
                          value={form.opponentAthleteId}
                        >
                          <SelectTrigger id="result-opponent">
                            <SelectValue placeholder="Choisir l’adversaire" />
                          </SelectTrigger>
                          <SelectContent>
                            {opponentOptions.map((athlete) => (
                              <SelectItem key={athlete.id} value={athlete.id}>
                                {athleteName(athlete)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="result-opponent-team">
                          Équipe adverse
                        </Label>
                        <Input
                          id="result-opponent-team"
                          maxLength={160}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              opponentTeamName: event.target.value,
                            }))
                          }
                          placeholder="Ex. Suisse"
                          value={form.opponentTeamName}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="result-score-for">
                        Score {form.participantType === "team" ? "équipe" : "tireur"}
                      </Label>
                      <Input
                        id="result-score-for"
                        min={0}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            scoreFor: event.target.value,
                          }))
                        }
                        type="number"
                        value={form.scoreFor}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="result-score-against">
                        Score adversaire
                      </Label>
                      <Input
                        id="result-score-against"
                        min={0}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            scoreAgainst: event.target.value,
                          }))
                        }
                        type="number"
                        value={form.scoreAgainst}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="result-round">Tour / phase</Label>
                      <Input
                        id="result-round"
                        maxLength={80}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            round: event.target.value,
                          }))
                        }
                        placeholder="Ex. Poule 1, T16, 1/4"
                        value={form.round}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="result-won">Issue</Label>
                      <Select
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            won: value as ResultForm["won"],
                          }))
                        }
                        value={form.won}
                      >
                        <SelectTrigger id="result-won">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Victoire</SelectItem>
                          <SelectItem value="false">Défaite</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="result-rank">Classement final</Label>
                      <Input
                        id="result-rank"
                        min={1}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            rank: event.target.value,
                          }))
                        }
                        required
                        type="number"
                        value={form.rank}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="result-seed-rank">
                        Classement initial{" "}
                        <span className="font-normal text-slate-400">
                          (facultatif)
                        </span>
                      </Label>
                      <Input
                        id="result-seed-rank"
                        min={1}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            seedRank: event.target.value,
                          }))
                        }
                        type="number"
                        value={form.seedRank}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="result-pool-rank">
                        Classement poule{" "}
                        <span className="font-normal text-slate-400">
                          (facultatif, si le tireur est concerné)
                        </span>
                      </Label>
                      <Input
                        id="result-pool-rank"
                        min={1}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            poolRank: event.target.value,
                          }))
                        }
                        type="number"
                        value={form.poolRank}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="result-observations">
                  Observations{" "}
                  <span className="font-normal text-slate-400">
                    (facultatif — analyse, contexte, commentaire libre)
                  </span>
                </Label>
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  id="result-observations"
                  maxLength={5000}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      observations: event.target.value,
                    }))
                  }
                  value={form.observations}
                />
              </div>

              {visibleCompetitions.length === 0 ? (
                <p className="text-sm text-amber-700">
                  Aucune compétition ne correspond au périmètre sélectionné.
                  Modifiez les filtres ou créez une compétition adaptée.
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                {editingId ? (
                  <Button onClick={resetForm} type="button" variant="outline">
                    <X className="mr-2 h-4 w-4" />
                    Annuler
                  </Button>
                ) : null}
                <Button disabled={isPending || !canSubmit} type="submit">
                  {editingId ? (
                    <Save className="mr-2 h-4 w-4" />
                  ) : (
                    <PlusCircle className="mr-2 h-4 w-4" />
                  )}
                  {editingId ? "Enregistrer" : "Ajouter"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Résultats de la saison</CardTitle>
          <CardDescription>
            Classements et résultats de poule/tableau réunis dans un même
            historique.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p
              className="rounded-md border border-accent/20 bg-accent-50 px-3 py-2 text-sm text-accent-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Compétition</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>Résultat</TableHead>
                <TableHead>Détail</TableHead>
                {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.id}>
                  <TableCell>
                    <p className="font-medium">{result.competition.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(result.competition.date)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {result.type === "bout" ? "Poule/Tableau" : "Classement"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {result.athlete
                      ? athleteName(result.athlete)
                      : result.team?.name ?? "—"}
                    {opponentLabel(result) ? (
                      <p className="text-xs text-slate-500">
                        vs {opponentLabel(result)}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {resultLabel(result)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {result.type === "ranking"
                      ? [
                          result.seedRank
                            ? `Initial ${result.seedRank}e`
                            : null,
                          result.poolRank ? `Poule ${result.poolRank}e` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"
                      : [
                          result.scoreFor !== null && result.scoreAgainst !== null
                            ? `${result.scoreFor}-${result.scoreAgainst}`
                            : null,
                          result.round,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                    {result.observations ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {result.observations}
                      </p>
                    ) : null}
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          aria-label="Modifier le résultat"
                          onClick={() => startEditing(result)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label="Supprimer le résultat"
                          onClick={() => void deleteResult(result)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4 text-accent" />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
              {results.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-slate-500"
                    colSpan={canManage ? 6 : 5}
                  >
                    Aucun résultat pour cette saison.
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
