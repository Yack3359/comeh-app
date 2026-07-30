import type { FencingCategoryValue } from "@/components/fencing-category";

export type Season = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  fiscalYears: Array<{
    id: string;
    label: string;
  }>;
};

export type BudgetCategory = {
  id: string;
  name: string;
  seasonId: string;
  _count: {
    budgets: number;
    expenses: number;
  };
};

export type BudgetRow = {
  id: string;
  name: string;
  budgets: Array<{
    budgetId: string | null;
    fencingCategory: FencingCategoryValue | null;
    plannedAmount: string;
  }>;
};

export type Expense = {
  id: string;
  seasonId: string;
  categoryId: string;
  fencingCategory: FencingCategoryValue | null;
  type: "ACCOMMODATION" | "TRAVEL";
  amount: string;
  date: string;
  description: string;
  relatedEvent: string | null;
  source: "MANUAL" | "IMPORT";
  category: { name: string };
  season: { label: string };
  createdBy: { name: string };
};

export type TrackingRow = {
  id: string;
  name: string;
  planned: number;
  spent: number;
  remaining: number;
  percentage: number;
};

export type TrackingData = {
  planned: number;
  spent: number;
  remaining: number;
  percentage: number;
  categories: TrackingRow[];
  fencingCategories: Array<{
    fencingCategory: FencingCategoryValue | null;
    planned: number;
    spent: number;
    remaining: number;
    percentage: number;
  }>;
  fiscalYears: Array<{
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    spent: number;
  }>;
};
