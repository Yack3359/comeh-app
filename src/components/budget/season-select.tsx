"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Season } from "./types";

type SeasonSelectProps = {
  seasons: Season[];
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
};

export function SeasonSelect({
  seasons,
  value,
  onValueChange,
  id,
}: SeasonSelectProps) {
  return (
    <Select onValueChange={onValueChange} value={value}>
      <SelectTrigger id={id}>
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
  );
}

