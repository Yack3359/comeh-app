"use client";

import { Info, RotateCcw, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  FencingCategoryValue,
  GenderValue,
  SelectionHelperAthlete,
  WeaponValue,
} from "./types";
import {
  athleteName,
  fencingCategoryLabels,
  genderLabels,
  requestJson,
  weaponLabels,
} from "./utils";

type SelectionHelperProps = {
  seasonId: string;
  version: number;
};

export function SelectionHelper({
  seasonId,
  version,
}: SelectionHelperProps) {
  const [category, setCategory] =
    useState<FencingCategoryValue>("SENIOR");
  const weapon: WeaponValue = "EPEE";
  const gender: GenderValue = "MALE";
  const [selectionSize, setSelectionSize] = useState(3);
  const [athletes, setAthletes] = useState<SelectionHelperAthlete[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!seasonId) {
      setAthletes([]);
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams({
      seasonId,
      category,
      weapon,
      gender,
    });

    setIsLoading(true);
    setError(null);
    setAthletes([]);
    void requestJson<SelectionHelperAthlete[]>(
      `/api/selection-helper?${params.toString()}`,
    )
      .then((data) => {
        if (!cancelled) {
          setAthletes(data);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Chargement impossible",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [category, gender, seasonId, version, weapon]);

  const suggestedIds = useMemo(
    () =>
      new Set(
        athletes
          .slice(0, selectionSize)
          .map((athlete) => athlete.athleteId),
      ),
    [athletes, selectionSize],
  );

  useEffect(() => {
    setSelectedIds(new Set(suggestedIds));
  }, [suggestedIds]);

  const selectedAthletes = useMemo(
    () => athletes.filter((athlete) => selectedIds.has(athlete.athleteId)),
    [athletes, selectedIds],
  );

  function toggleAthlete(athleteId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(athleteId)) {
        next.delete(athleteId);
      } else {
        next.add(athleteId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
        role="note"
      >
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold">
              Suggestion basée sur les points et résultats enregistrés — la
              décision finale reste collégiale (comité de sélection).
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              Cet écran synthétise les données pour faciliter les échanges. Il
              ne décide pas et n’enregistre aucune sélection.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Périmètre de la suggestion</CardTitle>
          <CardDescription>
            La saison est celle choisie en haut du module Rankings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="selection-category">Catégorie</Label>
              <Select
                onValueChange={(value) =>
                  setCategory(value as FencingCategoryValue)
                }
                value={category}
              >
                <SelectTrigger id="selection-category">
                  <SelectValue />
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
              <Label htmlFor="selection-weapon">Arme</Label>
              <Select disabled value="EPEE">
                <SelectTrigger id="selection-weapon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EPEE">{weaponLabels.EPEE}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="selection-gender">Sexe</Label>
              <Select disabled value="MALE">
                <SelectTrigger id="selection-gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">{genderLabels.MALE}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="selection-size">Nombre de tireurs (N)</Label>
              <Input
                id="selection-size"
                max="50"
                min="1"
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isInteger(value) && value >= 1 && value <= 50) {
                    setSelectionSize(value);
                  }
                }}
                type="number"
                value={selectionSize}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-primary" />
              Classement d’aide à la sélection
            </CardTitle>
            <CardDescription className="mt-1">
              Tri par points décroissants, puis par taux de victoire. Les
              données absentes sont affichées explicitement.
            </CardDescription>
          </div>
          <Button
            disabled={athletes.length === 0}
            onClick={() => setSelectedIds(new Set(suggestedIds))}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reprendre la suggestion
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm">
            <span className="font-semibold">
              Simulation actuelle : {selectedAthletes.length} tireur
              {selectedAthletes.length > 1 ? "s" : ""}
            </span>
            {selectedAthletes.length > 0 ? (
              <span className="text-slate-600">
                {" "}
                —{" "}
                {selectedAthletes
                  .map((athlete) => athleteName(athlete))
                  .join(", ")}
              </span>
            ) : (
              <span className="text-slate-500"> — aucune personne cochée</span>
            )}
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Inclure</TableHead>
                <TableHead className="w-16">Ordre</TableHead>
                <TableHead>Athlète</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Compétitions</TableHead>
                <TableHead className="text-right">Meilleur rang</TableHead>
                <TableHead className="text-right">Victoires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {athletes.map((athlete, index) => {
                const isSuggested = suggestedIds.has(athlete.athleteId);
                const isSelected = selectedIds.has(athlete.athleteId);

                return (
                  <TableRow
                    className={
                      isSuggested
                        ? "bg-emerald-50/80 hover:bg-emerald-50"
                        : isSelected
                          ? "bg-blue-50/70 hover:bg-blue-50"
                          : undefined
                    }
                    key={athlete.athleteId}
                  >
                    <TableCell>
                      <input
                        aria-label={`Inclure ${athleteName(athlete)} dans la simulation`}
                        checked={isSelected}
                        className="h-4 w-4 rounded border-slate-300 accent-primary"
                        onChange={() => toggleAthlete(athlete.athleteId)}
                        type="checkbox"
                      />
                    </TableCell>
                    <TableCell className="font-semibold">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {athleteName(athlete)}
                        </span>
                        {isSuggested ? (
                          <Badge className="bg-emerald-700 hover:bg-emerald-700">
                            Suggéré
                          </Badge>
                        ) : isSelected ? (
                          <Badge variant="outline">Retenu manuellement</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {athlete.club || "Club non renseigné"} ·{" "}
                        {athlete.country}
                      </p>
                      {athlete.selectionCriteria ? (
                        <p className="mt-1 text-xs font-medium text-slate-700">
                          {athlete.selectionCriteria}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {athlete.rankingPoints === null
                        ? "Non renseignés"
                        : new Intl.NumberFormat("fr-FR", {
                            maximumFractionDigits: 2,
                          }).format(athlete.rankingPoints)}
                    </TableCell>
                    <TableCell className="text-right">
                      {athlete.competitionCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {athlete.bestRank === null ? "—" : athlete.bestRank}
                    </TableCell>
                    <TableCell className="text-right">
                      {athlete.boutCount > 0
                        ? `${new Intl.NumberFormat("fr-FR", {
                            maximumFractionDigits: 1,
                          }).format(athlete.winRate)} % (${athlete.wins}/${athlete.boutCount})`
                        : "Aucun assaut"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && athletes.length === 0 && !error ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-slate-500"
                    colSpan={7}
                  >
                    Aucun athlète ne correspond à ce périmètre.
                  </TableCell>
                </TableRow>
              ) : null}
              {isLoading ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-slate-500"
                    colSpan={7}
                  >
                    Calcul de la synthèse…
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-center text-xs leading-5 text-slate-500">
        La simulation reste locale à cet écran et ne vaut ni décision, ni
        validation du comité de sélection.
      </p>
    </div>
  );
}
