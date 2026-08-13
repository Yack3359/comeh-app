"use client";

import { Eye, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Competition, CompetitionFilters } from "./types";
import {
  fencingCategoryLabels,
  genderLabels,
  weaponLabels,
} from "./utils";

export const defaultCompetitionFilters: CompetitionFilters = {
  enabled: true,
  weapon: "EPEE",
  gender: "MALE",
  categoryExclude: "none",
};

type CompetitionFilterPanelProps = {
  filters: CompetitionFilters;
  idPrefix: string;
  onChange: (filters: CompetitionFilters) => void;
};

export function appendCompetitionFilters(
  params: URLSearchParams,
  filters: CompetitionFilters,
) {
  if (!filters.enabled) {
    return params;
  }
  if (filters.weapon !== "all") {
    params.set("weapon", filters.weapon);
  }
  if (filters.gender !== "all") {
    params.set("gender", filters.gender);
  }
  if (filters.categoryExclude !== "none") {
    params.set("categoryExclude", filters.categoryExclude);
  }
  return params;
}

export function competitionMatchesFilters(
  competition: Competition,
  filters: CompetitionFilters,
) {
  if (!filters.enabled) {
    return true;
  }
  return (
    (filters.weapon === "all" || competition.weapon === filters.weapon) &&
    (filters.gender === "all" || competition.gender === filters.gender) &&
    (filters.categoryExclude === "none" ||
      competition.category !== filters.categoryExclude)
  );
}

export function CompetitionFilterPanel({
  filters,
  idPrefix,
  onChange,
}: CompetitionFilterPanelProps) {
  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Filter className="h-4 w-4" />
            Périmètre des compétitions
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Par défaut : Épée Hommes.
          </p>
        </div>
        <Button
          onClick={() => onChange({ ...filters, enabled: !filters.enabled })}
          size="sm"
          type="button"
          variant={filters.enabled ? "outline" : "default"}
        >
          <Eye className="mr-2 h-4 w-4" />
          {filters.enabled ? "Tout voir" : "Réactiver les filtres"}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-weapon`}>Arme</Label>
          <Select disabled value="EPEE">
            <SelectTrigger id={`${idPrefix}-weapon`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EPEE">{weaponLabels.EPEE}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-gender`}>Sexe</Label>
          <Select disabled value="MALE">
            <SelectTrigger id={`${idPrefix}-gender`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MALE">{genderLabels.MALE}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-category-exclude`}>
            Catégorie exclue
          </Label>
          <Select
            disabled={!filters.enabled}
            onValueChange={(categoryExclude) =>
              onChange({
                ...filters,
                categoryExclude:
                  categoryExclude as CompetitionFilters["categoryExclude"],
              })
            }
            value={filters.categoryExclude}
          >
            <SelectTrigger id={`${idPrefix}-category-exclude`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune exclusion</SelectItem>
              {Object.entries(fencingCategoryLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {!filters.enabled ? (
        <p className="mt-3 text-xs font-medium text-amber-700">
          Filtres désactivés : toutes les armes, tous les sexes et toutes les
          catégories sont affichés.
        </p>
      ) : null}
    </div>
  );
}
