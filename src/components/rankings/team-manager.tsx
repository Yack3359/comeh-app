"use client";

import { Pencil, PlusCircle, Save, Trash2, Users, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";

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

import type { Athlete, Team } from "./types";
import { athleteName, requestJson } from "./utils";

type TeamManagerProps = {
  seasonId: string;
  canManage: boolean;
  version: number;
  onChanged: () => void;
};

export function TeamManager({
  seasonId,
  canManage,
  version,
  onChanged,
}: TeamManagerProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [newMemberAthleteId, setNewMemberAthleteId] = useState("");
  const [newMemberBib, setNewMemberBib] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [isMemberPending, setIsMemberPending] = useState(false);

  const loadTeams = useCallback(async () => {
    if (!seasonId) {
      setTeams([]);
      return;
    }
    setTeams(
      await requestJson<Team[]>(
        `/api/teams?seasonId=${encodeURIComponent(seasonId)}`,
      ),
    );
  }, [seasonId]);

  useEffect(() => {
    setError(null);
    void loadTeams().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    });
    void requestJson<Athlete[]>("/api/athletes")
      .then(setAthletes)
      .catch(() => setAthletes([]));
  }, [loadTeams, version]);

  function cancelEditing() {
    setEditingId(null);
    setName("");
  }

  async function saveTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      await requestJson(editingId ? `/api/teams/${editingId}` : "/api/teams", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({ name, seasonId }),
      });
      cancelEditing();
      await loadTeams();
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

  async function deleteTeam(team: Team) {
    if (!window.confirm(`Supprimer l’équipe « ${team.name} » ?`)) {
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      await requestJson(`/api/teams/${team.id}`, { method: "DELETE" });
      await loadTeams();
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

  function nextAvailableBibNumber(team: Team) {
    const taken = new Set(
      team.members
        .map((member) => member.bibNumber)
        .filter((value): value is number => value !== null),
    );
    let candidate = 1;
    while (taken.has(candidate)) {
      candidate += 1;
    }
    return candidate;
  }

  function toggleComposition(team: Team) {
    setMemberError(null);
    setNewMemberAthleteId("");
    setNewMemberBib(
      expandedTeamId === team.id ? "" : String(nextAvailableBibNumber(team)),
    );
    setExpandedTeamId((current) => (current === team.id ? null : team.id));
  }

  async function addMember(team: Team, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newMemberAthleteId) {
      return;
    }
    setIsMemberPending(true);
    setMemberError(null);
    try {
      await requestJson(`/api/teams/${team.id}/members`, {
        method: "POST",
        body: JSON.stringify({
          athleteId: newMemberAthleteId,
          bibNumber: newMemberBib || null,
        }),
      });
      setNewMemberAthleteId("");
      setNewMemberBib((current) =>
        current ? String(Number(current) + 1) : "",
      );
      await loadTeams();
    } catch (mutationError) {
      setMemberError(
        mutationError instanceof Error
          ? mutationError.message
          : "Ajout impossible",
      );
    } finally {
      setIsMemberPending(false);
    }
  }

  async function removeMember(team: Team, athleteId: string) {
    setIsMemberPending(true);
    setMemberError(null);
    try {
      await requestJson(`/api/teams/${team.id}/members/${athleteId}`, {
        method: "DELETE",
      });
      await loadTeams();
    } catch (mutationError) {
      setMemberError(
        mutationError instanceof Error
          ? mutationError.message
          : "Suppression impossible",
      );
    } finally {
      setIsMemberPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Équipes de la saison</CardTitle>
        <CardDescription>
          Les équipes sont propres à la saison sélectionnée. Chaque équipe peut
          recevoir un classement final et une composition de tireurs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {canManage ? (
          <form
            className="flex flex-col items-end gap-3 sm:flex-row"
            onSubmit={saveTeam}
          >
            <div className="w-full flex-1 space-y-2">
              <Label htmlFor="team-name">Nom de l’équipe</Label>
              <Input
                id="team-name"
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex. Équipe de France A"
                required
                value={name}
              />
            </div>
            {editingId ? (
              <Button onClick={cancelEditing} type="button" variant="outline">
                <X className="mr-2 h-4 w-4" />
                Annuler
              </Button>
            ) : null}
            <Button disabled={isPending || !seasonId} type="submit">
              {editingId ? (
                <Save className="mr-2 h-4 w-4" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              {editingId ? "Enregistrer" : "Ajouter"}
            </Button>
          </form>
        ) : null}

        {error ? (
          <p
            className="rounded-md border border-accent/20 bg-accent-50 px-3 py-2 text-sm text-accent-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Composition</TableHead>
              <TableHead>Résultats</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => (
              <Fragment key={team.id}>
                <TableRow>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>
                    <Button
                      onClick={() => toggleComposition(team)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      {team.members.length} tireur
                      {team.members.length > 1 ? "s" : ""}
                    </Button>
                  </TableCell>
                  <TableCell>{team._count.results}</TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          aria-label={`Modifier ${team.name}`}
                          onClick={() => {
                            setEditingId(team.id);
                            setName(team.name);
                          }}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={`Supprimer ${team.name}`}
                          onClick={() => void deleteTeam(team)}
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
                {expandedTeamId === team.id ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 4 : 3}>
                      <div className="space-y-3 rounded-lg border bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-primary">
                          Composition — {team.name}
                        </p>
                        {memberError ? (
                          <p className="text-sm text-accent-700" role="alert">
                            {memberError}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {team.members.length === 0 ? (
                            <p className="text-sm text-slate-500">
                              Aucun tireur dans la composition.
                            </p>
                          ) : (
                            team.members.map((member) => (
                              <Badge
                                className="gap-1.5 border-slate-200 bg-white pr-1 text-slate-700"
                                key={member.id}
                                variant="outline"
                              >
                                {member.bibNumber ? `${member.bibNumber} · ` : ""}
                                {athleteName(member.athlete)}
                                {canManage ? (
                                  <button
                                    aria-label={`Retirer ${athleteName(member.athlete)}`}
                                    className="ml-1 rounded-full p-0.5 hover:bg-slate-100"
                                    disabled={isMemberPending}
                                    onClick={() =>
                                      void removeMember(team, member.athleteId)
                                    }
                                    type="button"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                ) : null}
                              </Badge>
                            ))
                          )}
                        </div>
                        {canManage ? (
                          <form
                            className="flex flex-wrap items-end gap-2"
                            onSubmit={(event) => void addMember(team, event)}
                          >
                            <div className="w-56 space-y-1">
                              <Label htmlFor={`member-athlete-${team.id}`}>
                                Tireur
                              </Label>
                              <Select
                                onValueChange={setNewMemberAthleteId}
                                value={newMemberAthleteId}
                              >
                                <SelectTrigger id={`member-athlete-${team.id}`}>
                                  <SelectValue placeholder="Choisir un tireur" />
                                </SelectTrigger>
                                <SelectContent>
                                  {athletes
                                    .filter(
                                      (athlete) =>
                                        !team.members.some(
                                          (member) => member.athleteId === athlete.id,
                                        ),
                                    )
                                    .map((athlete) => (
                                      <SelectItem key={athlete.id} value={athlete.id}>
                                        {athleteName(athlete)}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-24 space-y-1">
                              <Label htmlFor={`member-bib-${team.id}`}>N°</Label>
                              <Input
                                id={`member-bib-${team.id}`}
                                min={1}
                                onChange={(event) =>
                                  setNewMemberBib(event.target.value)
                                }
                                type="number"
                                value={newMemberBib}
                              />
                            </div>
                            <Button
                              disabled={
                                isMemberPending ||
                                !newMemberAthleteId ||
                                (newMemberBib !== "" &&
                                  team.members.some(
                                    (member) =>
                                      member.bibNumber === Number(newMemberBib),
                                  ))
                              }
                              size="sm"
                              type="submit"
                            >
                              <PlusCircle className="mr-2 h-4 w-4" />
                              Ajouter
                            </Button>
                          </form>
                        ) : null}
                        <p className="text-xs text-slate-500">
                          Le n° correspond à la position du tireur dans la
                          composition de l’équipe (1, 2, 3…) ; il ne peut pas
                          être réutilisé deux fois dans la même équipe.
                        </p>
                        {newMemberBib !== "" &&
                        team.members.some(
                          (member) => member.bibNumber === Number(newMemberBib),
                        ) ? (
                          <p className="text-xs font-medium text-accent-700">
                            Le n° {newMemberBib} est déjà attribué dans cette
                            équipe.
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
            {teams.length === 0 ? (
              <TableRow>
                <TableCell
                  className="py-10 text-center text-slate-500"
                  colSpan={canManage ? 4 : 3}
                >
                  Aucune équipe pour cette saison.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
