"use client";

import {
  Pencil,
  PlusCircle,
  Save,
  Tags,
  Trash2,
  X,
} from "lucide-react";
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

import type { Athlete, FencingCategoryValue, Season } from "./types";
import {
  athleteName,
  fencingCategoryLabels,
  formatFencingCategory,
  genderLabels,
  gripTypeLabels,
  handednessLabels,
  playStyleLabels,
  requestJson,
} from "./utils";

type AthleteManagerProps = {
  seasons: Season[];
  canManage: boolean;
  version: number;
  onChanged: () => void;
};

type AthleteForm = {
  firstName: string;
  lastName: string;
  gender: keyof typeof genderLabels;
  country: string;
  handedness: "RIGHT_HANDED" | "LEFT_HANDED" | "NONE";
  gripType: "CROSS" | "STRAIGHT" | "NONE";
  playStyle:
    | "OFFENSIVE"
    | "COUNTER_OFFENSIVE"
    | "DEFENSIVE"
    | "MIXED"
    | "OTHER"
    | "NONE";
  club: string;
};

const emptyForm: AthleteForm = {
  firstName: "",
  lastName: "",
  gender: "FEMALE",
  country: "",
  handedness: "RIGHT_HANDED",
  gripType: "CROSS",
  playStyle: "OFFENSIVE",
  club: "",
};

export function AthleteManager({
  seasons,
  canManage,
  version,
  onChanged,
}: AthleteManagerProps) {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [form, setForm] = useState<AthleteForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryAthleteId, setCategoryAthleteId] = useState("");
  const [categorySeasonId, setCategorySeasonId] = useState("");
  const [category, setCategory] = useState<FencingCategoryValue | "">("");
  const [rankingPoints, setRankingPoints] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadAthletes = useCallback(async () => {
    setAthletes(await requestJson<Athlete[]>("/api/athletes"));
  }, []);

  useEffect(() => {
    setError(null);
    void loadAthletes().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    });
  }, [loadAthletes, version]);

  useEffect(() => {
    setCategorySeasonId((current) => current || seasons[0]?.id || "");
  }, [seasons]);

  const categoryAthlete = useMemo(
    () => athletes.find((athlete) => athlete.id === categoryAthleteId),
    [athletes, categoryAthleteId],
  );

  useEffect(() => {
    const existing = categoryAthlete?.categorySeasons.find(
      (item) => item.seasonId === categorySeasonId,
    );
    setCategory(existing?.category ?? "");
    setRankingPoints(
      existing?.rankingPoints === null || existing?.rankingPoints === undefined
        ? ""
        : String(existing.rankingPoints),
    );
  }, [categoryAthlete, categorySeasonId]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function saveAthlete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setMessage(null);

    try {
      await requestJson(editingId ? `/api/athletes/${editingId}` : "/api/athletes", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          handedness: form.handedness === "NONE" ? null : form.handedness,
          gripType: form.gripType === "NONE" ? null : form.gripType,
          playStyle: form.playStyle === "NONE" ? null : form.playStyle,
          club: form.club || null,
        }),
      });
      setMessage(editingId ? "Profil mis à jour." : "Athlète créé.");
      resetForm();
      await loadAthletes();
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

  function startEditing(athlete: Athlete) {
    setEditingId(athlete.id);
    setForm({
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      gender: athlete.gender,
      country: athlete.country,
      handedness: athlete.handedness ?? "NONE",
      gripType: athlete.gripType ?? "NONE",
      playStyle: athlete.playStyle ?? "NONE",
      club: athlete.club ?? "",
    });
  }

  async function deleteAthlete(athlete: Athlete) {
    if (!window.confirm(`Supprimer ${athleteName(athlete)} ?`)) {
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      await requestJson(`/api/athletes/${athlete.id}`, { method: "DELETE" });
      if (categoryAthleteId === athlete.id) {
        setCategoryAthleteId("");
      }
      await loadAthletes();
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

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      await requestJson(`/api/athletes/${categoryAthleteId}/categories`, {
        method: "PUT",
        body: JSON.stringify({
          seasonId: categorySeasonId,
          category,
          rankingPoints: rankingPoints === "" ? null : Number(rankingPoints),
        }),
      });
      setMessage("Catégorie de saison enregistrée.");
      await loadAthletes();
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

  async function deleteCategory(seasonId: string) {
    setIsPending(true);
    setError(null);
    try {
      await requestJson(
        `/api/athletes/${categoryAthleteId}/categories?seasonId=${encodeURIComponent(seasonId)}`,
        { method: "DELETE" },
      );
      await loadAthletes();
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
    <div className="space-y-5">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {editingId ? "Modifier l’athlète" : "Ajouter un athlète"}
            </CardTitle>
            <CardDescription>
              Les caractéristiques du profil alimentent directement les
              statistiques adversaires.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveAthlete}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="athlete-first-name">Prénom</Label>
                  <Input
                    id="athlete-first-name"
                    maxLength={80}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    required
                    value={form.firstName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-last-name">Nom</Label>
                  <Input
                    id="athlete-last-name"
                    maxLength={80}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    required
                    value={form.lastName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-gender">Genre</Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        gender: value as AthleteForm["gender"],
                      }))
                    }
                    value={form.gender}
                  >
                    <SelectTrigger id="athlete-gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(genderLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-country">Pays</Label>
                  <Input
                    id="athlete-country"
                    maxLength={80}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        country: event.target.value,
                      }))
                    }
                    placeholder="France"
                    required
                    value={form.country}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-handedness">Main</Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        handedness: value as AthleteForm["handedness"],
                      }))
                    }
                    value={form.handedness}
                  >
                    <SelectTrigger id="athlete-handedness">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RIGHT_HANDED">Droitier</SelectItem>
                      <SelectItem value="LEFT_HANDED">Gaucher</SelectItem>
                      <SelectItem value="NONE">Non renseigné</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-grip">Poignet</Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        gripType: value as AthleteForm["gripType"],
                      }))
                    }
                    value={form.gripType}
                  >
                    <SelectTrigger id="athlete-grip">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CROSS">Cross</SelectItem>
                      <SelectItem value="STRAIGHT">Droite</SelectItem>
                      <SelectItem value="NONE">Non renseigné</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-style">Style de jeu</Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        playStyle: value as AthleteForm["playStyle"],
                      }))
                    }
                    value={form.playStyle}
                  >
                    <SelectTrigger id="athlete-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OFFENSIVE">Offensif</SelectItem>
                      <SelectItem value="COUNTER_OFFENSIVE">
                        Contre-offensif
                      </SelectItem>
                      <SelectItem value="DEFENSIVE">Défensif</SelectItem>
                      <SelectItem value="MIXED">Mixte</SelectItem>
                      <SelectItem value="OTHER">Autre</SelectItem>
                      <SelectItem value="NONE">Non renseigné</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-club">Club</Label>
                  <Input
                    id="athlete-club"
                    maxLength={120}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        club: event.target.value,
                      }))
                    }
                    value={form.club}
                  />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {editingId ? (
                  <Button onClick={resetForm} type="button" variant="outline">
                    <X className="mr-2 h-4 w-4" />
                    Annuler
                  </Button>
                ) : null}
                <Button disabled={isPending} type="submit">
                  {editingId ? (
                    <Save className="mr-2 h-4 w-4" />
                  ) : (
                    <PlusCircle className="mr-2 h-4 w-4" />
                  )}
                  {isPending
                    ? "Enregistrement…"
                    : editingId
                      ? "Enregistrer"
                      : "Ajouter"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

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

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Athlètes</CardTitle>
          <CardDescription>
            Profils techniques et catégories connues sur les différentes saisons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Athlète</TableHead>
                <TableHead>Profil</TableHead>
                <TableHead>Catégories</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {athletes.map((athlete) => (
                <TableRow key={athlete.id}>
                  <TableCell>
                    <p className="font-semibold text-slate-900">
                      {athleteName(athlete)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {athlete.club || "Club non renseigné"} · {athlete.country}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {handednessLabels[athlete.handedness ?? "UNKNOWN"]},{" "}
                    {gripTypeLabels[athlete.gripType ?? "UNKNOWN"]},{" "}
                    {playStyleLabels[athlete.playStyle ?? "UNKNOWN"]}
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {athlete.categorySeasons.slice(0, 3).map((item) => (
                        <Badge key={item.seasonId} variant="outline">
                          {item.season.label} ·{" "}
                          {formatFencingCategory(item.category)}
                        </Badge>
                      ))}
                      {athlete.categorySeasons.length === 0 ? (
                        <span className="text-sm text-slate-400">Aucune</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        aria-label={`Voir les catégories de ${athleteName(athlete)}`}
                        onClick={() => setCategoryAthleteId(athlete.id)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Tags className="h-4 w-4" />
                      </Button>
                      {canManage ? (
                        <>
                          <Button
                            aria-label={`Modifier ${athleteName(athlete)}`}
                            onClick={() => startEditing(athlete)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            aria-label={`Supprimer ${athleteName(athlete)}`}
                            disabled={isPending}
                            onClick={() => void deleteAthlete(athlete)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4 text-accent" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {athletes.length === 0 ? (
                <TableRow>
                  <TableCell className="py-10 text-center text-slate-500" colSpan={4}>
                    Aucun athlète enregistré.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {categoryAthlete ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              Catégories de {athleteName(categoryAthlete)}
            </CardTitle>
            <CardDescription>
              Une seule catégorie est conservée par athlète et par saison.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {canManage ? (
              <form
                className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
                onSubmit={saveCategory}
              >
                <div className="space-y-2">
                  <Label htmlFor="athlete-category-season">Saison</Label>
                  <Select
                    onValueChange={setCategorySeasonId}
                    value={categorySeasonId}
                  >
                    <SelectTrigger id="athlete-category-season">
                      <SelectValue placeholder="Saison" />
                    </SelectTrigger>
                    <SelectContent>
                      {seasons.map((season) => (
                        <SelectItem key={season.id} value={season.id}>
                          {season.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-category">Catégorie</Label>
                  <Select
                    onValueChange={(value) =>
                      setCategory(value as FencingCategoryValue)
                    }
                    value={category}
                  >
                    <SelectTrigger id="athlete-category">
                      <SelectValue placeholder="Choisir une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
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
                <div className="space-y-2">
                  <Label htmlFor="athlete-ranking-points">
                    Points au classement
                  </Label>
                  <Input
                    id="athlete-ranking-points"
                    inputMode="decimal"
                    max="99999999.99"
                    min="0.01"
                    onChange={(event) => setRankingPoints(event.target.value)}
                    placeholder="Optionnel"
                    step="0.01"
                    type="number"
                    value={rankingPoints}
                  />
                </div>
                <Button
                  disabled={isPending || !categorySeasonId || !category}
                  type="submit"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </Button>
              </form>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Saison</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Points au classement</TableHead>
                  {canManage ? <TableHead className="w-16" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryAthlete.categorySeasons.map((item) => (
                  <TableRow key={item.seasonId}>
                    <TableCell>{item.season.label}</TableCell>
                    <TableCell className="font-medium">
                      {formatFencingCategory(item.category)}
                    </TableCell>
                    <TableCell>
                      {item.rankingPoints === null
                        ? "Non renseignés"
                        : new Intl.NumberFormat("fr-FR", {
                            maximumFractionDigits: 2,
                          }).format(item.rankingPoints)}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <Button
                          aria-label={`Supprimer la catégorie ${item.season.label}`}
                          onClick={() => void deleteCategory(item.seasonId)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4 text-accent" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
                {categoryAthlete.categorySeasons.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="py-8 text-center text-slate-500"
                      colSpan={canManage ? 4 : 3}
                    >
                      Aucune catégorie enregistrée.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
