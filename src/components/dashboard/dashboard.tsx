"use client";

import {
  ArrowRight,
  BadgeEuro,
  CalendarRange,
  FileUp,
  Medal,
  ReceiptText,
  Swords,
  TrendingDown,
  Users,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { SeasonSelect } from "@/components/budget/season-select";
import type { Season, TrackingData } from "@/components/budget/types";
import {
  formatCurrency,
  formatDate,
  requestJson,
} from "@/components/budget/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RankingsSummary = {
  activeAthletes: number;
  competitions: number;
  results: number;
};

type DashboardProps = {
  canImport: boolean;
};

function PercentageBar({ percentage }: { percentage: number }) {
  const displayed = Math.min(Math.max(percentage, 0), 100);

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn(
          "h-full rounded-full",
          percentage > 100
            ? "bg-accent"
            : percentage >= 80
              ? "bg-amber-500"
              : "bg-primary",
        )}
        style={{ width: `${displayed}%` }}
      />
    </div>
  );
}

export function Dashboard({ canImport }: DashboardProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState("");
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [rankings, setRankings] = useState<RankingsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void requestJson<Season[]>("/api/seasons")
      .then((data) => {
        if (!active) return;
        setSeasons(data);
        setSeasonId(data[0]?.id ?? "");
        setIsLoading(false);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les saisons",
        );
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!seasonId) {
      setTracking(null);
      setRankings(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    setTracking(null);
    setRankings(null);

    void Promise.all([
      requestJson<TrackingData>(
        `/api/budget-tracking?seasonId=${encodeURIComponent(seasonId)}`,
      ),
      requestJson<RankingsSummary>(
        `/api/rankings-summary?seasonId=${encodeURIComponent(seasonId)}`,
      ),
    ])
      .then(([budgetData, rankingsData]) => {
        if (!active) return;
        setTracking(budgetData);
        setRankings(rankingsData);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger le tableau de bord",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [seasonId]);

  const season = useMemo(
    () => seasons.find((item) => item.id === seasonId),
    [seasonId, seasons],
  );
  const topCategories = useMemo(
    () =>
      [...(tracking?.categories ?? [])]
        .sort(
          (left, right) =>
            right.percentage - left.percentage || right.spent - left.spent,
        )
        .slice(0, 3),
    [tracking],
  );

  if (error && !tracking) {
    return (
      <div className="rounded-xl border border-accent/20 bg-accent-50 p-5 text-sm text-accent-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-institutional">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-y-0 right-0 w-2 bg-accent" />
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-blue-100">
                FF Escrime · COMmission Épée Homme
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Tableau de bord COMEH
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                L’état du budget et de l’activité sportive de la saison en un
                coup d’œil.
              </p>
            </div>

            <div className="w-full rounded-xl bg-white/10 p-3 backdrop-blur-sm lg:w-72">
              <label
                className="mb-1.5 block text-xs font-semibold text-blue-100"
                htmlFor="dashboard-season"
              >
                Saison affichée
              </label>
              <SeasonSelect
                id="dashboard-season"
                onValueChange={setSeasonId}
                seasons={seasons}
                value={seasonId}
              />
              {season ? (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-100">
                  <CalendarRange className="h-3.5 w-3.5" />
                  {formatDate(season.startDate)} – {formatDate(season.endDate)}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {!seasonId && !isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-slate-500">
            Aucune saison n’est disponible.
          </CardContent>
        </Card>
      ) : null}

      {isLoading && !tracking ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-slate-500">
            Chargement de la synthèse…
          </CardContent>
        </Card>
      ) : null}

      {tracking ? (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-primary">
                  Budget de la saison
                </h2>
                <p className="text-sm text-slate-500">
                  Situation calculée à partir des frais enregistrés.
                </p>
              </div>
              {tracking.percentage > 100 ? (
                <Badge variant="destructive">Budget dépassé</Badge>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Prévu",
                  value: formatCurrency(tracking.planned),
                  icon: BadgeEuro,
                  tone: "bg-primary-50 text-primary",
                },
                {
                  label: "Dépensé",
                  value: formatCurrency(tracking.spent),
                  icon: TrendingDown,
                  tone: "bg-amber-50 text-amber-700",
                },
                {
                  label: "Reste",
                  value: formatCurrency(tracking.remaining),
                  icon: WalletCards,
                  tone:
                    tracking.remaining < 0
                      ? "bg-accent-50 text-accent"
                      : "bg-emerald-50 text-emerald-700",
                },
                {
                  label: "Consommé",
                  value: `${tracking.percentage.toLocaleString("fr-FR", {
                    maximumFractionDigits: 1,
                  })} %`,
                  icon: ReceiptText,
                  tone:
                    tracking.percentage > 100
                      ? "bg-accent-50 text-accent"
                      : "bg-slate-100 text-slate-700",
                },
              ].map(({ label, value, icon: Icon, tone }) => (
                <Card key={label}>
                  <CardContent className="flex items-center gap-4 p-5">
                    <div
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-lg",
                        tone,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                        {value}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">
                  Catégories les plus consommées
                </CardTitle>
                <CardDescription>
                  Les trois taux de consommation les plus élevés.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {topCategories.map((category) => (
                  <div className="space-y-2" key={category.id}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-900">
                        {category.name}
                      </span>
                      <span className="tabular-nums text-slate-600">
                        {formatCurrency(category.spent)} ·{" "}
                        {category.percentage.toLocaleString("fr-FR", {
                          maximumFractionDigits: 1,
                        })}{" "}
                        %
                      </span>
                    </div>
                    <PercentageBar percentage={category.percentage} />
                  </div>
                ))}
                {topCategories.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    Aucune catégorie pour cette saison.
                  </p>
                ) : null}
                <Button asChild className="mt-2" size="sm" variant="outline">
                  <Link href="/budget">
                    Voir le suivi complet
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Activité rankings</CardTitle>
                <CardDescription>
                  Chiffres enregistrés pour la saison sélectionnée.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      label: "Athlètes actifs",
                      value: rankings?.activeAthletes ?? 0,
                      icon: Users,
                    },
                    {
                      label: "Compétitions",
                      value: rankings?.competitions ?? 0,
                      icon: Medal,
                    },
                    {
                      label: "Résultats",
                      value: rankings?.results ?? 0,
                      icon: Swords,
                    },
                  ].map(({ label, value, icon: Icon }) => (
                    <div
                      className="rounded-lg border bg-slate-50 p-4"
                      key={label}
                    >
                      <Icon className="mb-3 h-5 w-5 text-primary" />
                      <p className="text-2xl font-bold tabular-nums text-slate-900">
                        {value}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                <Button asChild className="mt-5" size="sm" variant="outline">
                  <Link href="/rankings">
                    Ouvrir les rankings
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Accès rapides</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Button asChild className="justify-between" variant="outline">
                <Link href="/budget">
                  <span className="flex items-center gap-2">
                    <WalletCards className="h-4 w-4" />
                    Frais & budget
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild className="justify-between" variant="outline">
                <Link href="/rankings">
                  <span className="flex items-center gap-2">
                    <Medal className="h-4 w-4" />
                    Rankings
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              {canImport ? (
                <Button asChild className="justify-between" variant="outline">
                  <Link href="/imports">
                    <span className="flex items-center gap-2">
                      <FileUp className="h-4 w-4" />
                      Import
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
