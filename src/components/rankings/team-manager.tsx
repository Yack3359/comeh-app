"use client";

import { Pencil, PlusCircle, Save, Trash2, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { Team } from "./types";
import { requestJson } from "./utils";

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
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Équipes de la saison</CardTitle>
        <CardDescription>
          Les équipes sont propres à la saison sélectionnée et peuvent recevoir
          un classement final.
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
              <TableHead>Résultats</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => (
              <TableRow key={team.id}>
                <TableCell className="font-medium">{team.name}</TableCell>
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
            ))}
            {teams.length === 0 ? (
              <TableRow>
                <TableCell
                  className="py-10 text-center text-slate-500"
                  colSpan={canManage ? 3 : 2}
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
