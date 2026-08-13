"use client";

import {
  CalendarRange,
  Eye,
  Medal,
  Rows3,
  Swords,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { AthleteHistory } from "./athlete-history";
import { AthleteManager } from "./athlete-manager";
import { BulkResultEntry } from "./bulk-result-entry";
import { CompetitionManager } from "./competition-manager";
import { OpponentStats } from "./opponent-stats";
import { ResultManager } from "./result-manager";
import { SelectionHelper } from "./selection-helper";
import { TeamManager } from "./team-manager";
import type { Season } from "./types";
import { formatDate, requestJson } from "./utils";

type RankingsModuleProps = {
  canManage: boolean;
};

export function RankingsModule({ canManage }: RankingsModuleProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState("");
  const [dataVersion, setDataVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("athletes");
  const [statsAthleteId, setStatsAthleteId] = useState<string | undefined>();

  function viewAthleteStats(athleteId: string) {
    setStatsAthleteId(athleteId);
    setActiveTab("stats");
  }

  useEffect(() => {
    void requestJson<Season[]>("/api/seasons")
      .then((data) => {
        setSeasons(data);
        setSeasonId((current) => current || data[0]?.id || "");
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
                  Module Rankings
                </p>
                {!canManage ? (
                  <Badge
                    className="border-white/30 bg-white/10 text-white"
                    variant="outline"
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    Lecture seule
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Piloter les performances sportives
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                Centralisez les profils, résultats et historiques pour mieux
                comprendre chaque performance face aux différents adversaires.
              </p>
            </div>

            <div className="w-full rounded-xl bg-white/10 p-3 backdrop-blur-sm lg:w-72">
              <label
                className="mb-1.5 block text-xs font-semibold text-blue-100"
                htmlFor="rankings-season"
              >
                Saison de travail
              </label>
              <Select onValueChange={setSeasonId} value={seasonId}>
                <SelectTrigger id="rankings-season">
                  <SelectValue placeholder="Choisir une saison" />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {!seasonId && seasons.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-slate-500">
          Aucune saison n’est disponible. Exécutez d’abord le jeu de données
          initial du projet.
        </div>
      ) : (
        <Tabs onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4 xl:grid-cols-8">
            <TabsTrigger value="athletes">Athlètes</TabsTrigger>
            <TabsTrigger value="teams">Équipes</TabsTrigger>
            <TabsTrigger value="competitions">Compétitions</TabsTrigger>
            <TabsTrigger value="results">Résultats</TabsTrigger>
            <TabsTrigger value="bulk-entry">
              <Rows3 className="mr-1.5 h-4 w-4" />
              Saisie rapide
            </TabsTrigger>
            <TabsTrigger value="stats">
              <Swords className="mr-1.5 h-4 w-4" />
              Stats adversaires
            </TabsTrigger>
            <TabsTrigger value="history">
              <Medal className="mr-1.5 h-4 w-4" />
              Historique
            </TabsTrigger>
            <TabsTrigger value="selection">
              <UsersRound className="mr-1.5 h-4 w-4" />
              Aide à la sélection
            </TabsTrigger>
          </TabsList>

          <TabsContent className="mt-5" value="athletes">
            <AthleteManager
              canManage={canManage}
              onChanged={() => setDataVersion((current) => current + 1)}
              onViewStats={viewAthleteStats}
              seasons={seasons}
              version={dataVersion}
            />
          </TabsContent>
          <TabsContent className="mt-5" value="teams">
            <TeamManager
              canManage={canManage}
              onChanged={() => setDataVersion((current) => current + 1)}
              seasonId={seasonId}
              version={dataVersion}
            />
          </TabsContent>
          <TabsContent className="mt-5" value="competitions">
            <CompetitionManager
              canManage={canManage}
              onChanged={() => setDataVersion((current) => current + 1)}
              seasonId={seasonId}
              seasons={seasons}
              version={dataVersion}
            />
          </TabsContent>
          <TabsContent className="mt-5" value="results">
            <ResultManager
              canManage={canManage}
              onChanged={() => setDataVersion((current) => current + 1)}
              seasonId={seasonId}
              version={dataVersion}
            />
          </TabsContent>
          <TabsContent className="mt-5" value="bulk-entry">
            <BulkResultEntry
              canManage={canManage}
              onChanged={() => setDataVersion((current) => current + 1)}
              seasonId={seasonId}
              version={dataVersion}
            />
          </TabsContent>
          <TabsContent className="mt-5" value="stats">
            <OpponentStats
              initialAthleteId={statsAthleteId}
              seasons={seasons}
              version={dataVersion}
            />
          </TabsContent>
          <TabsContent className="mt-5" value="history">
            <AthleteHistory version={dataVersion} />
          </TabsContent>
          <TabsContent className="mt-5" value="selection">
            <SelectionHelper seasonId={seasonId} version={dataVersion} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
