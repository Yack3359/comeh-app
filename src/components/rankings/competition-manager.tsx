"use client";

import { Pencil, PlusCircle, Save, Trash2, X } from "lucide-react";
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

import type {
  Competition,
  FencingCategoryValue,
  GenderValue,
  Season,
  WeaponValue,
} from "./types";
import {
  fencingCategoryLabels,
  formatDate,
  genderLabels,
  requestJson,
  weaponLabels,
} from "./utils";

type CompetitionManagerProps = {
  seasons: Season[];
  seasonId: string;
  canManage: boolean;
  version: number;
  onChanged: () => void;
};

type CompetitionForm = {
  name: string;
  location: string;
  country: string;
  date: string;
  level: string;
  weapon: WeaponValue | "NONE";
  gender: GenderValue | "NONE";
  category: FencingCategoryValue | "NONE";
};

const emptyForm: CompetitionForm = {
  name: "",
  location: "",
  country: "",
  date: "",
  level: "",
  weapon: "NONE",
  gender: "NONE",
  category: "NONE",
};

export function CompetitionManager({
  seasons,
  seasonId,
  canManage,
  version,
  onChanged,
}: CompetitionManagerProps) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [form, setForm] = useState<CompetitionForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const season = useMemo(
    () => seasons.find((item) => item.id === seasonId),
    [seasonId, seasons],
  );

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

  useEffect(() => {
    setError(null);
    void loadCompetitions().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    });
  }, [loadCompetitions, version]);

  useEffect(() => {
    setEditingId(null);
    setForm({ ...emptyForm, date: season?.startDate.slice(0, 10) ?? "" });
  }, [season]);

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, date: season?.startDate.slice(0, 10) ?? "" });
  }

  async function saveCompetition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      await requestJson(
        editingId ? `/api/competitions/${editingId}` : "/api/competitions",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify({
            ...form,
            seasonId,
            weapon: form.weapon === "NONE" ? null : form.weapon,
            gender: form.gender === "NONE" ? null : form.gender,
            category: form.category === "NONE" ? null : form.category,
          }),
        },
      );
      resetForm();
      await loadCompetitions();
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

  async function deleteCompetition(competition: Competition) {
    if (
      !window.confirm(
        `Supprimer « ${competition.name} » et tous ses résultats ?`,
      )
    ) {
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      await requestJson(`/api/competitions/${competition.id}`, {
        method: "DELETE",
      });
      await loadCompetitions();
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

  function startEditing(competition: Competition) {
    setEditingId(competition.id);
    setForm({
      name: competition.name,
      location: competition.location,
      country: competition.country,
      date: competition.date.slice(0, 10),
      level: competition.level,
      weapon: competition.weapon ?? "NONE",
      gender: competition.gender ?? "NONE",
      category: competition.category ?? "NONE",
    });
  }

  return (
    <div className="space-y-5">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {editingId ? "Modifier la compétition" : "Ajouter une compétition"}
            </CardTitle>
            <CardDescription>
              La date doit appartenir à la saison de travail sélectionnée.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveCompetition}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="competition-name">Nom</Label>
                  <Input
                    id="competition-name"
                    maxLength={160}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                    value={form.name}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competition-location">Lieu</Label>
                  <Input
                    id="competition-location"
                    maxLength={120}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                    required
                    value={form.location}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competition-country">Pays</Label>
                  <Input
                    id="competition-country"
                    maxLength={80}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        country: event.target.value,
                      }))
                    }
                    required
                    value={form.country}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competition-date">Date</Label>
                  <Input
                    id="competition-date"
                    max={season?.endDate.slice(0, 10)}
                    min={season?.startDate.slice(0, 10)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                    required
                    type="date"
                    value={form.date}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competition-level">Niveau</Label>
                  <Input
                    id="competition-level"
                    maxLength={80}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        level: event.target.value,
                      }))
                    }
                    placeholder="Ex. Coupe du monde"
                    required
                    value={form.level}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competition-weapon">
                    Arme{" "}
                    <span className="font-normal text-slate-400">
                      (facultatif)
                    </span>
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        weapon: value as CompetitionForm["weapon"],
                      }))
                    }
                    value={form.weapon}
                  >
                    <SelectTrigger id="competition-weapon">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Non renseignée</SelectItem>
                      {Object.entries(weaponLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competition-gender">
                    Sexe{" "}
                    <span className="font-normal text-slate-400">
                      (facultatif)
                    </span>
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        gender: value as CompetitionForm["gender"],
                      }))
                    }
                    value={form.gender}
                  >
                    <SelectTrigger id="competition-gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Non renseigné</SelectItem>
                      {Object.entries(genderLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competition-category">
                    Catégorie{" "}
                    <span className="font-normal text-slate-400">
                      (facultatif)
                    </span>
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        category: value as CompetitionForm["category"],
                      }))
                    }
                    value={form.category}
                  >
                    <SelectTrigger id="competition-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Non renseignée</SelectItem>
                      {Object.entries(fencingCategoryLabels).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {editingId ? (
                  <Button onClick={resetForm} type="button" variant="outline">
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
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Compétitions</CardTitle>
          <CardDescription>
            Calendrier et volume de résultats de la saison.
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Compétition</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Épreuve</TableHead>
                <TableHead>Résultats</TableHead>
                {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitions.map((competition) => (
                <TableRow key={competition.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(competition.date)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{competition.name}</p>
                    <p className="text-xs text-slate-500">
                      {competition.location}, {competition.country}
                    </p>
                  </TableCell>
                  <TableCell>{competition.level}</TableCell>
                  <TableCell>
                    <p className="text-sm">
                      {competition.weapon
                        ? weaponLabels[competition.weapon]
                        : "Arme non renseignée"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {competition.gender
                        ? genderLabels[competition.gender]
                        : "Sexe non renseigné"}
                      {" · "}
                      {competition.category
                        ? fencingCategoryLabels[competition.category]
                        : "Catégorie non renseignée"}
                    </p>
                  </TableCell>
                  <TableCell>{competition._count.results}</TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          aria-label={`Modifier ${competition.name}`}
                          onClick={() => startEditing(competition)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={`Supprimer ${competition.name}`}
                          onClick={() => void deleteCompetition(competition)}
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
              {competitions.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-slate-500"
                    colSpan={canManage ? 6 : 5}
                  >
                    Aucune compétition pour cette saison.
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
