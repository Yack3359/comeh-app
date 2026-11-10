"use client";

import {
  ArrowRight,
  BadgeEuro,
  FileUp,
  Target,
  ReceiptText,
  TrendingDown,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { SeasonBanner } from "@/components/budget/season-banner";
import type { Season, TrackingData } from "@/components/budget/types";
import {
  formatCurrency,
  formatDate,
  requestJson,
} from "@/components/budget/utils";
import { FlagBadge } from "@/components/pilotage/shared";
import { PilotageHeadline } from "@/components/pilotage/pilotage-headline";
import type { PreparationData } from "@/components/preparation/types";
import type { PilotageData } from "@/components/pilotage/types";
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
  const [pilotage, setPilotage] = useState<PilotageData | null>(null);
  const [preparation, setPreparation] = useState<PreparationData | null>(null);
  const [preparationLoading, setPreparationLoading] = useState(true);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const nextYear = String(new Date().getFullYear() + 1);
  const [pilotageLoading, setPilotageLoading] = useState(true);
  const [pilotageError, setPilotageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/pilotage", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (response.status === 404) return null;
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || "Impossible de charger le pilotage budgétaire");
        return body as PilotageData;
      })
      .then(data => { if (!controller.signal.aborted) setPilotage(data); })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setPilotageError(loadError instanceof Error ? loadError.message : "Impossible de charger le pilotage budgétaire");
      })
      .finally(() => { if (!controller.signal.aborted) setPilotageLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/budget-preparation?fiscalYear=" + nextYear, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (response.status === 404) return null;
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || "Impossible de charger la préparation du budget");
        return body as PreparationData;
      }).then(data => { if (!controller.signal.aborted) setPreparation(data); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setPreparationError(failure instanceof Error ? failure.message : "Impossible de charger la préparation"); })
      .finally(() => { if (!controller.signal.aborted) setPreparationLoading(false); });
    return () => controller.abort();
  }, [nextYear]);

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
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    setTracking(null);

    void requestJson<TrackingData>(
      `/api/budget-tracking?seasonId=${encodeURIComponent(seasonId)}`,
    )
      .then((budgetData) => {
        if (!active) return;
        setTracking(budgetData);
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
                Accueil COMEH
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                Le pilotage budgétaire de la commission et les dépenses de la
                saison en un coup d’œil.
              </p>
            </div>

            <SeasonBanner
              activeSeasonLabel={season?.label}
              dateRangeLabel={
                season
                  ? `${formatDate(season.startDate)} – ${formatDate(season.endDate)}`
                  : undefined
              }
              id="dashboard-season"
              onSeasonChange={setSeasonId}
              seasonId={seasonId}
              seasons={seasons}
            />
          </div>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-accent/20 bg-accent-50 p-5 text-sm text-accent-700">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-xl">Budget {pilotage?.fiscalYear.label ?? new Date().getFullYear()} — où en est-on ?</CardTitle></CardHeader>
          <CardContent className="space-y-4">{pilotageLoading ? <p className="text-sm text-slate-500">Chargement du suivi…</p> : pilotageError ? <p role="alert" className="text-sm text-accent-700">{pilotageError}</p> :
            pilotage?.fiscalYear.phase === "PREPARATION" ? <p>Le budget est en préparation. <Link className="underline" href={"/preparation?fiscalYear=" + pilotage.fiscalYear.label}>Ouvrir la préparation</Link></p> :
            pilotage?.posts.length ? <><PilotageHeadline data={pilotage} /><FlagBadge flag={pilotage.summary.flag} />
              <ul className="space-y-2 text-sm">{[...pilotage.vigilance].sort((a, b) => ({ red: 0, orange: 1, info: 2 }[a.level] - { red: 0, orange: 1, info: 2 }[b.level])).slice(0, 3).map((point, index) =>
                <li key={index} className={point.level === "red" ? "text-accent-700" : point.level === "orange" ? "text-amber-700" : "text-slate-600"}>{point.message}</li>)}</ul>
            </> : <p className="text-sm text-slate-500">Aucune matrice importée.</p>}
            <Button asChild size="sm" variant="outline"><Link href="/pilotage">Ouvrir le suivi du budget<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-xl">Budget {nextYear} — préparation</CardTitle></CardHeader><CardContent className="space-y-4">
          {preparationLoading ? <p className="text-sm text-slate-500">Chargement de la préparation…</p> : preparationError ? <p role="alert" className="text-sm text-accent-700">{preparationError}</p> : preparation?.posts.length ? <>
            <p className="text-sm leading-7 text-primary">{preparation.progress.headline}</p><progress className="h-3 w-full accent-primary" value={preparation.progress.percent} max={100} aria-label="Avancement de la préparation" />
            <p className="text-sm font-semibold">{preparation.progress.percent} %</p><div className="grid grid-cols-3 gap-3">{[
              ["À confirmer", preparation.progress.pending], ["À chiffrer", preparation.progress.unpriced], ["À arbitrer", preparation.progress.arbitration],
            ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-2xl font-bold text-primary">{value}</p><p className="text-xs text-slate-600">{label}</p></div>)}</div>
          </> : <p className="text-sm leading-7 text-slate-600">La préparation n’est pas encore ouverte. Reprenez les actions de l’année précédente ou commencez avec une trame vide.</p>}
          <Button asChild><Link href={"/preparation?fiscalYear=" + nextYear}>Préparer le budget {nextYear}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </CardContent></Card>
      </div>

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
                  Suivi des frais par saison
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

          <div className="grid gap-5">
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
                  <Link href="/budget?vue=suivi">
                    Voir le suivi complet
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Accès rapides</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Button asChild className="justify-between" variant="outline">
            <Link href="/budget">
              <span className="flex items-center gap-2">
                <WalletCards className="h-4 w-4" />
                Notes de frais
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild className="justify-between" variant="outline">
            <Link href="/pilotage">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Suivi du budget
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild className="justify-between" variant="outline"><Link href="/preparation"><span className="flex items-center gap-2"><Target className="h-4 w-4" />Préparer le budget</span><ArrowRight className="h-4 w-4" /></Link></Button>
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
    </div>
  );
}
