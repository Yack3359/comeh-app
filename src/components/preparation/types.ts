import type { loadPreparation } from "@/lib/budget-preparation-query";

type JsonDates<T> = T extends Date ? string : T extends Array<infer V> ? JsonDates<V>[] : T extends object ? { [K in keyof T]: JsonDates<T[K]> } : T;
export type PreparationData = JsonDates<NonNullable<Awaited<ReturnType<typeof loadPreparation>>>>;
export type PreparationLine = PreparationData["lines"][number];
