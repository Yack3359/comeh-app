"use client";

import {
  AlertTriangle,
  BadgeEuro,
  CalendarDays,
  Download,
  RefreshCw,
  TrendingDown,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { TrackingData } from "./types";
import { formatCurrency, formatDate, requestJson } from "./utils";

type BudgetTrackingProps = {
  seasonId: string;
  dataVersion: number;
};

function ProgressBar({ percentage }: { percentage: number }) {
  const visualPercentage = Math.min(Math.max(percentage, 0), 100);
  const isOver = percentage > 100;
  const isWarning = percentage >= 80;

  return (
    <div className="space-y-1.5">
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isOver
              ? "bg-accent"
              : isWarning
                ? "bg-amber-500"
                : "bg-primary",
          )}
          style={{ width: `${visualPercentage}%` }}
        />
      </div>
      <p className="text-right text-xs tabular-nums text-slate-500">
        {percentage.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
      </p>
    </div>
  );
}

export function BudgetTracking({
  seasonId,
  dataVersion,
}: BudgetTrackingProps) {
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTracking = useCallback(async () => {
    if (!seasonId) {
      setTracking(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setTracking(
        await requestJson<TrackingData>(
          `/api/budget-tracking?seasonId=${encodeURIComponent(seasonId)}`,
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Calcul impossible",
      );
    } finally {
      setIsLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    void loadTracking();
  }, [dataVersion, loadTracking]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-accent-700">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!tracking) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-slate-500">
          {isLoading ? "Calcul du suivi…" : "Sélectionnez une saison."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary-50 text-primary">
              <BadgeEuro className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Budget prévu
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-primary">
                {formatCurrency(tracking.planned)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-amber-50 text-amber-700">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Dépenses réelles
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {formatCurrency(tracking.spent)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={
            tracking.remaining < 0 ? "border-accent/30 bg-accent-50/40" : ""
          }
        >
          <CardContent className="flex items-center gap-4 p-5">
            <div
              className={cn(
                "grid h-11 w-11 place-items-center rounded-lg",
                tracking.remaining < 0
                  ? "bg-accent/10 text-accent"
                  : "bg-emerald-50 text-emerald-700",
              )}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reste disponible
              </p>
              <p
                className={cn(
                  "mt-1 text-xl font-bold tabular-nums",
                  tracking.remaining < 0 ? "text-accent" : "text-emerald-800",
                )}
              >
                {formatCurrency(tracking.remaining)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <CalendarDays className="h-5 w-5 text-primary" />
            Répartition par année civile
          </CardTitle>
          <CardDescription>
            Dépenses affectées selon la date de chaque frais et les bornes des
            années civiles liées à la saison.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {tracking.fiscalYears.map((fiscalYear) => (
              <div
                className="rounded-lg border bg-slate-50 p-5"
                key={fiscalYear.id}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Dépenses {fiscalYear.label}
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-primary">
                  {formatCurrency(fiscalYear.spent)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Du {formatDate(fiscalYear.startDate)} au{" "}
                  {formatDate(fiscalYear.endDate)}
                </p>
              </div>
            ))}
          </div>
          {tracking.fiscalYears.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
              Aucune année civile n’est liée à cette saison.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="items-start gap-4 space-y-0 sm:flex-row sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-xl">Consommation du budget</CardTitle>
            <CardDescription>
              Calculée à partir des dépenses enregistrées au moment du chargement.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <a
                download
                href={`/api/budget-tracking/export?seasonId=${encodeURIComponent(
                  seasonId,
                )}`}
              >
                <Download className="mr-2 h-4 w-4" />
                Exporter en CSV
              </a>
            </Button>
            <Button
              aria-label="Actualiser le suivi"
              disabled={isLoading}
              onClick={() => void loadTracking()}
              size="icon"
              type="button"
              variant="outline"
            >
              <RefreshCw
                className={cn("h-4 w-4", isLoading && "animate-spin")}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-semibold text-primary">Vue globale</span>
              {tracking.percentage > 100 ? (
                <Badge className="bg-accent" variant="destructive">
                  Budget dépassé
                </Badge>
              ) : null}
            </div>
            <ProgressBar percentage={tracking.percentage} />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Prévu</TableHead>
                <TableHead className="text-right">Dépensé</TableHead>
                <TableHead className="text-right">Reste</TableHead>
                <TableHead className="min-w-40">Consommation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracking.categories.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.planned)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.spent)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      row.remaining < 0 ? "text-accent" : "text-emerald-700",
                    )}
                  >
                    {formatCurrency(row.remaining)}
                  </TableCell>
                  <TableCell>
                    <ProgressBar percentage={row.percentage} />
                  </TableCell>
                </TableRow>
              ))}
              {tracking.categories.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-slate-500"
                    colSpan={5}
                  >
                    Aucune catégorie pour cette saison.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
