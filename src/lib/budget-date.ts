// Compare calendar months in the fiscal year, consistently for imports and vigilance.
export function isPlannedMonthPast(plannedMonth: number | null, asOfDate: Date | null, fiscalYearLabel: string | null): boolean {
  if (plannedMonth === null || !asOfDate || !fiscalYearLabel || !/^\d{4}$/.test(fiscalYearLabel)) return false;
  const year = Number(fiscalYearLabel);
  return asOfDate.getUTCFullYear() > year ||
    (asOfDate.getUTCFullYear() === year && plannedMonth < asOfDate.getUTCMonth() + 1);
}
