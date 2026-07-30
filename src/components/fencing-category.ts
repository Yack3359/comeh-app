export const fencingCategories = [
  "SENIOR",
  "U23",
  "M20",
  "M17",
  "M15",
  "M13",
  "VETERAN",
] as const;

export type FencingCategoryValue = (typeof fencingCategories)[number];

export const fencingCategoryLabels: Record<FencingCategoryValue, string> = {
  SENIOR: "Sénior",
  U23: "U23",
  M20: "M20 (moins de 20 ans)",
  M17: "M17 (moins de 17 ans)",
  M15: "M15",
  M13: "M13",
  VETERAN: "Vétéran",
};

export const fencingCategoryStyles: Record<
  FencingCategoryValue,
  {
    badge: string;
    card: string;
    accent: string;
    progress: string;
  }
> = {
  SENIOR: {
    badge: "border-blue-200 bg-blue-50 text-blue-800",
    card: "border-blue-200 bg-blue-50/50",
    accent: "bg-blue-100 text-blue-700",
    progress: "bg-blue-600",
  },
  U23: {
    badge: "border-violet-200 bg-violet-50 text-violet-800",
    card: "border-violet-200 bg-violet-50/50",
    accent: "bg-violet-100 text-violet-700",
    progress: "bg-violet-600",
  },
  M20: {
    badge: "border-green-200 bg-green-50 text-green-800",
    card: "border-green-200 bg-green-50/50",
    accent: "bg-green-100 text-green-700",
    progress: "bg-green-600",
  },
  M17: {
    badge: "border-orange-200 bg-orange-50 text-orange-800",
    card: "border-orange-200 bg-orange-50/50",
    accent: "bg-orange-100 text-orange-700",
    progress: "bg-orange-500",
  },
  M15: {
    badge: "border-teal-200 bg-teal-50 text-teal-800",
    card: "border-teal-200 bg-teal-50/50",
    accent: "bg-teal-100 text-teal-700",
    progress: "bg-teal-600",
  },
  M13: {
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    card: "border-rose-200 bg-rose-50/50",
    accent: "bg-rose-100 text-rose-700",
    progress: "bg-rose-500",
  },
  VETERAN: {
    badge: "border-slate-300 bg-slate-100 text-slate-700",
    card: "border-slate-300 bg-slate-50",
    accent: "bg-slate-200 text-slate-700",
    progress: "bg-slate-600",
  },
};

export function formatFencingCategory(value: string) {
  return (
    fencingCategoryLabels[value as FencingCategoryValue] ?? value
  );
}
