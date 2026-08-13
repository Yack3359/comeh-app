"use client";

import { CheckCircle2, PlusCircle, Rows3, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import type { Athlete, Competition } from "./types";
import { athleteName, requestJson } from "./utils";

type BulkMode = "ranking" | "bout";

type BulkRow = {
  key: string;
  athleteId: string;
  // ranking mode
  rank: string;
  seedRank: string;
  poolRank: string;
  // bout mode
  opponentAthleteId: string;
  scoreFor: string;
  scoreAgainst: string;
  round: string;
  observations: string;
};

type BulkResultEntryProps = {
  seasonId: string;
  canManage: boolean;
  version: number;
  onChanged: () => void;
};

let rowKeySeed = 0;
function newRowKey() {
  rowKeySeed += 1;
  return `row-${rowKeySeed}`;
}

function emptyRow(athleteId = ""): BulkRow {
  return {
    key: newRowKey(),
    athleteId,
    rank: "",
    seedRank: "",
    poolRank: "",
    opponentAthleteId: "",
    scoreFor: "",
    scoreAgainst: "",
    round: "",
    observations: "",
  };
}

export function BulkResultEntry({
  seasonId,
  canManage,
  version,
  onChanged,
}: BulkResultEntryProps) {
  const [mode, setMode] = useState<BulkMode>("ranking");
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [rows, setRows] = useState<BulkRow[]>([emptyRow()]);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!seasonId) {
      setCompetitions([]);
      setAthletes([]);
      return;
    }

    const [competitionData, athleteData] = await Promise.all([
      requestJson<Competition[]>(
        `/api/competitions?seasonId=${encodeURIComponent(seasonId)}`,
      ),
      requestJson<Athlete[]>("/api/athletes"),
    ]);
    setCompetitions(competitionData);
    setAthletes(athleteData);
    setCompetitionId((current) =>
      competitionData.some((item) => item.id === current)
        ? current
        : (competitionData[0]?.id ?? ""),
    );
  }, [seasonId]);

  useEffect(() => {
    setError(null);
    void loadData().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    });
  }, [loadData, version]);

  useEffect(() => {
    setRows([emptyRow()]);
    setMessage(null);
  }, [seasonId, mode]);

  const usedAthleteIds = useMemo(
    () => new Set(rows.map((row) => row.athleteId).filter(Boolean)),
    [rows],
  );

  function updateRow(key: string, patch: Partial<BulkRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function addAllAthletes() {
    setRows((current) => {
      const existing = new Set(
        current.map((row) => row.athleteId).filter(Boolean),
      );
      const additions = athletes
        .filter((athlete) => !existing.has(athlete.id))
        .map((athlete) => emptyRow(athlete.id));
      const base = current.filter((row) => row.athleteId || row === current[0]);
      return additions.length > 0 ? [...base, ...additions] : current;
    });
  }

  function removeRow(key: string) {
    setRows((current) =>
      current.length > 1 ? current.filter((row) => row.key !== key) : current,
    );
  }

  function opponentOptionsFor(athleteId: string) {
    return athletes.filter((athlete) => athlete.id !== athleteId);
  }

  async function saveAll() {
    setIsPending(true);
    setError(null);
    setMessage(null);

    const readyRows = rows.filter((row) =>
      mode === "ranking"
        ? row.athleteId && row.rank
        : row.athleteId && row.opponentAthleteId && row.scoreFor && row.scoreAgainst,
    );

    if (!competitionId) {
      setError("Choisissez une compétition avant d’enregistrer.");
      setIsPending(false);
      return;
    }
    if (readyRows.length === 0) {
      setError(
        mode === "ranking"
          ? "Renseignez au moins une ligne complète (athlète et classement)."
          : "Renseignez au moins une ligne complète (athlète, adversaire et score).",
      );
      setIsPending(false);
      return;
    }

    let successCount = 0;
    const failures: string[] = [];

    for (const row of readyRows) {
      try {
        const body =
          mode === "ranking"
            ? {
                type: "ranking",
                competitionId,
                participantType: "athlete",
                athleteId: row.athleteId,
                rank: row.rank,
                seedRank: row.seedRank || null,
                poolRank: row.poolRank || null,
                observations: row.observations,
              }
            : {
                type: "bout",
                competitionId,
                participantType: "athlete",
                athleteId: row.athleteId,
                opponentAthleteId: row.opponentAthleteId,
                scoreFor: row.scoreFor,
                scoreAgainst: row.scoreAgainst,
                won: Number(row.scoreFor) > Number(row.scoreAgainst),
                round: row.round,
                observations: row.observations,
              };

        await requestJson("/api/results", {
          method: "POST",
          body: JSON.stringify(body),
        });
        successCount += 1;
      } catch (rowError) {
        const athlete = athletes.find((item) => item.id === row.athleteId);
        failures.push(
          `${athlete ? athleteName(athlete) : "Ligne"} : ${
            rowError instanceof Error ? rowError.message : "échec"
          }`,
        );
      }
    }

    if (successCount > 0) {
      const stillIncomplete = rows.filter(
        (row) =>
          !(mode === "ranking"
            ? row.athleteId && row.rank
            : row.athleteId && row.opponentAthleteId && row.scoreFor && row.scoreAgainst),
      );
      setRows(failures.length > 0 ? stillIncomplete : [emptyRow()]);
      onChanged();
    }

    setMessage(
      successCount > 0
        ? `${successCount} résultat${successCount > 1 ? "s" : ""} enregistré${successCount > 1 ? "s" : ""}.`
        : null,
    );
    setError(failures.length > 0 ? failures.join(" | ") : null);
    setIsPending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Rows3 className="h-5 w-5" />
          Saisie rapide au kilomètre
        </CardTitle>
        <CardDescription>
          Choisissez une compétition, un type de saisie, puis renseignez les
          lignes une par une. Complémentaire à l’import de fichier.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="max-w-sm flex-1 space-y-2">
            <Label htmlFor="bulk-competition">Compétition</Label>
            <Select onValueChange={setCompetitionId} value={competitionId}>
              <SelectTrigger id="bulk-competition">
                <SelectValue placeholder="Choisir une compétition" />
              </SelectTrigger>
              <SelectContent>
                {competitions.map((competition) => (
                  <SelectItem key={competition.id} value={competition.id}>
                    {competition.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Tabs onValueChange={(value) => setMode(value as BulkMode)} value={mode}>
            <TabsList>
              <TabsTrigger value="ranking">Classement</TabsTrigger>
              <TabsTrigger value="bout">Résultat poule / tableau</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {!canManage ? (
          <p className="text-sm text-slate-500">
            Lecture seule : vous n’avez pas les droits pour saisir des
            résultats.
          </p>
        ) : (
          <>
            {error ? (
              <p
                className="rounded-md border border-accent/20 bg-accent-50 px-3 py-2 text-sm text-accent-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                {message}
              </p>
            ) : null}

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-40">Athlète</TableHead>
                    {mode === "ranking" ? (
                      <>
                        <TableHead className="w-28">Classt. final</TableHead>
                        <TableHead className="w-28">Classt. initial</TableHead>
                        <TableHead className="w-28">Classt. poule</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="min-w-40">Adversaire</TableHead>
                        <TableHead className="w-24">Score tireur</TableHead>
                        <TableHead className="w-24">Score adv.</TableHead>
                        <TableHead className="w-32">Tour / phase</TableHead>
                      </>
                    )}
                    <TableHead className="min-w-40">Observations</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>
                        <Select
                          onValueChange={(value) =>
                            updateRow(row.key, { athleteId: value })
                          }
                          value={row.athleteId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Athlète" />
                          </SelectTrigger>
                          <SelectContent>
                            {athletes.map((athlete) => (
                              <SelectItem key={athlete.id} value={athlete.id}>
                                {athleteName(athlete)}
                                {usedAthleteIds.has(athlete.id) &&
                                athlete.id !== row.athleteId
                                  ? " (déjà en ligne)"
                                  : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {mode === "ranking" ? (
                        <>
                          <TableCell>
                            <Input
                              min={1}
                              onChange={(event) =>
                                updateRow(row.key, { rank: event.target.value })
                              }
                              type="number"
                              value={row.rank}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              min={1}
                              onChange={(event) =>
                                updateRow(row.key, {
                                  seedRank: event.target.value,
                                })
                              }
                              type="number"
                              value={row.seedRank}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              min={1}
                              onChange={(event) =>
                                updateRow(row.key, {
                                  poolRank: event.target.value,
                                })
                              }
                              type="number"
                              value={row.poolRank}
                            />
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <Select
                              onValueChange={(value) =>
                                updateRow(row.key, { opponentAthleteId: value })
                              }
                              value={row.opponentAthleteId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Adversaire" />
                              </SelectTrigger>
                              <SelectContent>
                                {opponentOptionsFor(row.athleteId).map(
                                  (athlete) => (
                                    <SelectItem key={athlete.id} value={athlete.id}>
                                      {athleteName(athlete)}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              min={0}
                              onChange={(event) =>
                                updateRow(row.key, {
                                  scoreFor: event.target.value,
                                })
                              }
                              type="number"
                              value={row.scoreFor}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              min={0}
                              onChange={(event) =>
                                updateRow(row.key, {
                                  scoreAgainst: event.target.value,
                                })
                              }
                              type="number"
                              value={row.scoreAgainst}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              maxLength={80}
                              onChange={(event) =>
                                updateRow(row.key, { round: event.target.value })
                              }
                              placeholder="Poule 1, T16…"
                              value={row.round}
                            />
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Input
                          maxLength={500}
                          onChange={(event) =>
                            updateRow(row.key, {
                              observations: event.target.value,
                            })
                          }
                          value={row.observations}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          aria-label="Supprimer la ligne"
                          disabled={rows.length === 1}
                          onClick={() => removeRow(row.key)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4 text-accent" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Button onClick={addRow} size="sm" type="button" variant="outline">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Ajouter une ligne
                </Button>
                {mode === "ranking" ? (
                  <Button
                    disabled={athletes.length === 0}
                    onClick={addAllAthletes}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Rows3 className="mr-2 h-4 w-4" />
                    Ajouter tous les athlètes
                  </Button>
                ) : null}
              </div>
              <Button
                disabled={isPending || !competitionId}
                onClick={() => void saveAll()}
                type="button"
              >
                {isPending
                  ? "Enregistrement…"
                  : `Enregistrer les lignes complètes`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
