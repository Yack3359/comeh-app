"use client";

import { CalendarRange } from "lucide-react";

import { SeasonSelect } from "./season-select";

type SeasonBannerSeason = {
  id: string;
  label: string;
};

type SeasonBannerProps = {
  id: string;
  seasons: SeasonBannerSeason[];
  seasonId: string;
  onSeasonChange: (seasonId: string) => void;
  activeSeasonLabel?: string;
  dateRangeLabel?: string;
};

export function SeasonBanner({
  id,
  seasons,
  seasonId,
  onSeasonChange,
  activeSeasonLabel,
  dateRangeLabel,
}: SeasonBannerProps) {
  return (
    <div className="w-full rounded-xl bg-white/10 p-3 backdrop-blur-sm lg:w-72">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
        Saison
      </p>
      <p className="mt-0.5 truncate text-lg font-bold text-white">
        {activeSeasonLabel ?? "Aucune saison"}
      </p>
      <div className="mt-2">
        <label className="sr-only" htmlFor={id}>
          Changer de saison
        </label>
        <SeasonSelect
          id={id}
          onValueChange={onSeasonChange}
          seasons={seasons}
          value={seasonId}
        />
      </div>
      {dateRangeLabel ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-100">
          <CalendarRange className="h-3.5 w-3.5" />
          {dateRangeLabel}
        </div>
      ) : null}
    </div>
  );
}
