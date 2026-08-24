"use client";

import { CalendarRange, Download, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { pickDefaultSeasonId } from "@/lib/season-utils";

import { BudgetEditor } from "./budget-editor";
import { BudgetTracking } from "./budget-tracking";
import { CategoryManager } from "./category-manager";
import { ExpenseImportPanel } from "./expense-import-panel";
import { ExpenseManager } from "./expense-manager";
import { SeasonSelect } from "./season-select";
import type { Season } from "./types";
import { formatDate, requestJson } from "./utils";

type BudgetModuleProps = {
  canManage: boolean;
};

export function BudgetModule({ canManage }: BudgetModuleProps) {
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
                  Module Frais & budget
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

            <div className="w-full rounded-xl bg-white/10 p-3 backdrop-blur-sm lg:w-72">
              <label
                className="mb-1.5 block text-xs font-semibold text-blue-100"
                htmlFor="module-season"
              >
                Saison de travail
              </label>
              <SeasonSelect
                id="module-season"
                onValueChange={setSeasonId}
                seasons={seasons}
                value={seasonId}
              />
              {season ? (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-100">
                  <CalendarRange className="h-3.5 w-3.5" />
                  {formatDate(season.startDate)} – {formatDate(season.endDate)}
                  {season.fiscalYears.length ? (
                    <span>
                      · exercices{" "}
                      {season.fiscalYears.map(({ label }) => label).join(" / ")}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <Button
                asChild
                className="mt-3 w-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
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

      {!seasonId && seasons.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-slate-500">
          Aucune saison n’est disponible. Exécutez d’abord le jeu de données
          initial du projet.
        </div>
      ) : (
        <Tabs defaultValue="tracking">
          <TabsList
            className={`grid h-auto w-full grid-cols-2 gap-1 p-1 ${
              canManage ? "sm:grid-cols-5" : "sm:grid-cols-4"
            }`}
          >
            <TabsTrigger value="tracking">Suivi budgétaire</TabsTrigger>
            <TabsTrigger value="expenses">Notes de frais</TabsTrigger>
            {canManage ? (
              <TabsTrigger value="import">Importer</TabsTrigger>
            ) : null}
            <TabsTrigger value="budget">Prévisionnel</TabsTrigger>
            <TabsTrigger value="categories">Catégories</TabsTrigger>
          </TabsList>

          <TabsContent className="mt-5" value="tracking">
            <BudgetTracking dataVersion={dataVersion} seasonId={seasonId} />
          </TabsContent>
          <TabsContent className="mt-5" value="expenses">
            <ExpenseManager
              canManage={canManage}
              categoryVersion={categoryVersion}
              onChanged={() => setDataVersion((current) => current + 1)}
              onSeasonChange={setSeasonId}
              seasonId={seasonId}
              seasons={seasons}
            />
          </TabsContent>
          {canManage ? (
            <TabsContent className="mt-5" value="import">
              <ExpenseImportPanel
                onChanged={() => setDataVersion((current) => current + 1)}
                seasons={seasons}
              />
            </TabsContent>
          ) : null}
          <TabsContent className="mt-5" value="budget">
            <BudgetEditor
              canManage={canManage}
              categoryVersion={categoryVersion}
              onChanged={() => setDataVersion((current) => current + 1)}
              seasonId={seasonId}
              seasons={seasons}
            />
          </TabsContent>
          <TabsContent className="mt-5" value="categories">
            <CategoryManager
              canManage={canManage}
              onChanged={categoriesChanged}
              seasonId={seasonId}
              version={categoryVersion}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

