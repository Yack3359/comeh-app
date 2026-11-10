"use client";

import { Download, Eye } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pickDefaultSeasonId } from "@/lib/season-utils";

import { BudgetEditor } from "./budget-editor";
import { BudgetTracking } from "./budget-tracking";
import { CategoryManager } from "./category-manager";
import { ExpenseImportPanel } from "./expense-import-panel";
import { ExpenseManager } from "./expense-manager";
import { FfeExportPanel } from "./ffe-export-panel";
import { SeasonBanner } from "./season-banner";
import type { Season } from "./types";
import { formatDate, requestJson } from "./utils";

type BudgetModuleProps = {
  canManage: boolean;
};

const viewTitles = {
  suivi: "Suivi des frais par saison", notes: "Notes de frais", "export-ffe": "Export FFE",
  import: "Importer des justificatifs", previsionnel: "Prévisionnel par saison", categories: "Catégories",
};

export function BudgetModule(props: BudgetModuleProps) {
  return <Suspense fallback={null}><BudgetModuleContent {...props} /></Suspense>;
}

function BudgetModuleContent({ canManage }: BudgetModuleProps) {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("vue") ?? "suivi";
  const view = Object.prototype.hasOwnProperty.call(viewTitles, requestedView) && (requestedView !== "import" || canManage)
    ? requestedView as keyof typeof viewTitles : "suivi";
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState("");
  const [categoryVersion, setCategoryVersion] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void requestJson<Season[]>("/api/seasons")
      .then((data) => {
        setSeasons(data);
        setSeasonId((current) => current || pickDefaultSeasonId(data) || "");
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les saisons",
        );
      });
  }, []);

  const season = useMemo(
    () => seasons.find((item) => item.id === seasonId),
    [seasonId, seasons],
  );

  function categoriesChanged() {
    setCategoryVersion((current) => current + 1);
    setDataVersion((current) => current + 1);
  }

  if (error) {
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
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-100">
                  Module Notes de frais
                </p>
                {!canManage ? (
                  <Badge className="border-white/30 bg-white/10 text-white" variant="outline">
                    <Eye className="mr-1 h-3 w-3" />
                    Lecture seule
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Piloter les dépenses de la COMEH
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                Saisissez les frais, ajustez le prévisionnel et visualisez
                immédiatement le budget disponible.
              </p>
            </div>

            <div className="w-full space-y-3 lg:w-72">
              <SeasonBanner
                activeSeasonLabel={season?.label}
                dateRangeLabel={
                  season
                    ? `${formatDate(season.startDate)} – ${formatDate(season.endDate)}${
                        season.fiscalYears.length
                          ? ` · exercices ${season.fiscalYears
                              .map(({ label }) => label)
                              .join(" / ")}`
                          : ""
                      }`
                    : undefined
                }
                id="module-season"
                onSeasonChange={setSeasonId}
                seasonId={seasonId}
                seasons={seasons}
              />
              <Button
                asChild
                className="w-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                size="sm"
                variant="outline"
              >
                <a href="/api/budget-tracking/export-all" download>
                  <Download className="mr-2 h-4 w-4" />
                  Exporter toutes les données (CSV)
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <h2 className="text-xl font-bold text-primary">{viewTitles[view]}</h2>
      {!seasonId && seasons.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-slate-500">
          Aucune saison n’est disponible. Exécutez d’abord le jeu de données
          initial du projet.
        </div>
      ) : (
        <>
          {view === "suivi" && <BudgetTracking
            canManage={canManage}
            dataVersion={dataVersion}
            onBudgetChanged={categoriesChanged}
            seasonId={seasonId}
          />}
          {view === "notes" && <ExpenseManager
            canManage={canManage}
            categoryVersion={categoryVersion}
            onChanged={() => setDataVersion((current) => current + 1)}
            onSeasonChange={setSeasonId}
            seasonId={seasonId}
            seasons={seasons}
          />}
          {view === "export-ffe" && <FfeExportPanel seasonId={seasonId} />}
          {view === "import" && <ExpenseImportPanel
            onChanged={() => setDataVersion((current) => current + 1)}
            seasons={seasons}
          />}
          {view === "previsionnel" && <BudgetEditor
            canManage={canManage}
            categoryVersion={categoryVersion}
            onChanged={() => setDataVersion((current) => current + 1)}
            seasonId={seasonId}
            seasons={seasons}
          />}
          {view === "categories" && <CategoryManager
            canManage={canManage}
            onChanged={categoriesChanged}
            seasonId={seasonId}
            version={categoryVersion}
          />}
        </>
      )}
    </div>
  );
}

