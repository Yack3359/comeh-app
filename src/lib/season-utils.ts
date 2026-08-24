export type SeasonDateRange = {
  id: string;
  startDate: string;
  endDate: string;
};

export function pickDefaultSeasonId(seasons: SeasonDateRange[]): string {
  if (seasons.length === 0) {
    return "";
  }

  const now = new Date();

  const current = seasons.find(
    (season) =>
      new Date(season.startDate) <= now && now <= new Date(season.endDate),
  );
  if (current) {
    return current.id;
  }

  const mostRecentlyEnded = [...seasons]
    .filter((season) => new Date(season.endDate) < now)
    .sort(
      (left, right) =>
        new Date(right.endDate).getTime() - new Date(left.endDate).getTime(),
    )[0];
  if (mostRecentlyEnded) {
    return mostRecentlyEnded.id;
  }

  const closestUpcoming = [...seasons]
    .filter((season) => new Date(season.startDate) > now)
    .sort(
      (left, right) =>
        new Date(left.startDate).getTime() -
        new Date(right.startDate).getTime(),
    )[0];

  return closestUpcoming?.id ?? seasons[0]!.id;
}
