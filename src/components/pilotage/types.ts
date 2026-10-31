import type { loadPilotage } from "@/lib/budget-pilotage-query";
import type { ParsedMatrix } from "@/lib/budget-matrix";
import type { MatrixDiff } from "@/lib/budget-matrix-diff";

type JsonDates<T> = T extends Date ? string : T extends Array<infer V> ? JsonDates<V>[] : T extends object ? { [K in keyof T]: JsonDates<T[K]> } : T;
export type PilotageData = JsonDates<NonNullable<Awaited<ReturnType<typeof loadPilotage>>>>;
export type BudgetAction = PilotageData["actions"][number];
export type MatrixPreview = { parsed: ParsedMatrix; diff: MatrixDiff; fiscalYear: { id: string; label: string };
  existingActions: Array<{ id: string; postCode: string; label: string }> };
export type ImportResult = { created: number; updated: number; unchanged: number; missing: number };
