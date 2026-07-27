"use client";

import { Crosshair, Shield, Swords, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { Athlete, OpponentStatsData, Season } from "./types";
import {
  athleteName,
  formatCharacteristic,
  groupByLabels,
  requestJson,
} from "./utils";

type OpponentStatsProps = {
  seasons: Season[];
  version: number;
};

export function OpponentStats({ seasons, version }: OpponentStatsProps) {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [seasonId, setSeasonId] = useState("all");
  const [groupBy, setGroupBy] =
    useState<keyof typeof groupByLabels>("country");
  const [country, setCountry] = useState("all");
  const [handedness, setHandedness] = useState("all");
  const [gripType, setGripType] = useState("all");
  const [playStyle, setPlayStyle] = useState("all");
  const [stats, setStats] = useState<OpponentStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void requestJson<Athlete[]>("/api/athletes")
      .then((data) => {
        setAthletes(data);
        setAthleteId((current) => current || data[0]?.id || "");
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error ? loadError.message : "Chargement impossible",
        );
      });
  }, [version]);

  const countries = useMemo(
    () =>
      Array.from(new Set(athletes.map((athlete) => athlete.country))).sort(
        (left, right) => left.localeCompare(right, "fr"),
      ),
    [athletes],
  );

  const loadStats = useCallback(async () => {
    if (!athleteId) {
      setStats(null);
      return;
    }
    const params = new URLSearchParams({ athleteId, groupBy });
    if (seasonId !== "all") params.set("seasonId", seasonId);
    if (country !== "all") params.set("country", country);
    if (handedness !== "all") params.set("handedness", handedness);
    if (gripType !== "all") params.set("gripType", gripType);
    if (playStyle !== "all") params.set("playStyle", playStyle);
    setStats(await requestJson<OpponentStatsData>(`/api/opponent-stats?${params}`));
  }, [athleteId, country, gripType, groupBy, handedness, playStyle, seasonId]);

  useEffect(() => {
    setError(null);
    void loadStats().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    });
  }, [loadStats, version]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Stats adversaires</CardTitle>
          <CardDescription>
            Croisez les assauts par profil adverse pour identifier les contextes
            de force et les axes de travail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="stats-athlete">Athlète analysé</Label>
              <Select onValueChange={setAthleteId} value={athleteId}>
                <SelectTrigger id="stats-athlete">
                  <SelectValue placeholder="Choisir un athlète" />
                </SelectTrigger>
                <SelectContent>
                  {athletes.map((athlete) => (
                    <SelectItem key={athlete.id} value={athlete.id}>
                      {athleteName(athlete)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stats-season">Saison</Label>
              <Select onValueChange={setSeasonId} value={seasonId}>
                <SelectTrigger id="stats-season">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les saisons</SelectItem>
                  {seasons.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stats-group">Regrouper par</Label>
              <Select
                onValueChange={(value) =>
                  setGroupBy(value as keyof typeof groupByLabels)
                }
                value={groupBy}
              >
                <SelectTrigger id="stats-group">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupByLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stats-country">Pays adverse</Label>
              <Select onValueChange={setCountry} value={country}>
                <SelectTrigger id="stats-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les pays</SelectItem>
                  {countries.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stats-handedness">Main adverse</Label>
              <Select onValueChange={setHandedness} value={handedness}>
                <SelectTrigger id="stats-handedness">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="RIGHT_HANDED">Droitier</SelectItem>
                  <SelectItem value="LEFT_HANDED">Gaucher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stats-grip">Poignet adverse</Label>
              <Select onValueChange={setGripType} value={gripType}>
                <SelectTrigger id="stats-grip">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="CROSS">Cross</SelectItem>
                  <SelectItem value="STRAIGHT">Droite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stats-style">Style adverse</Label>
              <Select onValueChange={setPlayStyle} value={playStyle}>
                <SelectTrigger id="stats-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="OFFENSIVE">Offensif</SelectItem>
                  <SelectItem value="COUNTER_OFFENSIVE">
                    Contre-offensif
                  </SelectItem>
                  <SelectItem value="DEFENSIVE">Défensif</SelectItem>
                  <SelectItem value="MIXED">Mixte</SelectItem>
                  <SelectItem value="OTHER">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p
          className="rounded-md border border-accent/20 bg-accent-50 px-3 py-2 text-sm text-accent-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="rounded-lg bg-primary-50 p-2 text-primary">
              <Swords className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Assauts
              </p>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
              <Trophy className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Victoires
              </p>
              <p className="text-2xl font-bold">{stats?.wins ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
              <Crosshair className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Taux de victoire
              </p>
              <p className="text-2xl font-bold">
                {(stats?.winRate ?? 0).toFixed(1)} %
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-5 w-5 text-primary" />
            Performance par {groupByLabels[groupBy].toLowerCase()}
          </CardTitle>
          <CardDescription>
            Un taux élevé signale un profil favorable ; un taux faible, un axe
            de préparation prioritaire.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{groupByLabels[groupBy]}</TableHead>
                <TableHead>Assauts</TableHead>
                <TableHead>Victoires / défaites</TableHead>
                <TableHead className="w-64">Taux de victoire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.groups.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">
                    {formatCharacteristic(groupBy, row.key)}
                  </TableCell>
                  <TableCell>{row.total}</TableCell>
                  <TableCell>
                    {row.wins} / {row.losses}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            row.winRate >= 60
                              ? "bg-emerald-500"
                              : row.winRate < 40
                                ? "bg-accent"
                                : "bg-amber-500"
                          }`}
                          style={{ width: `${row.winRate}%` }}
                        />
                      </div>
                      <Badge className="w-16 justify-center" variant="outline">
                        {row.winRate.toFixed(1)} %
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!stats || stats.groups.length === 0 ? (
                <TableRow>
                  <TableCell className="py-10 text-center text-slate-500" colSpan={4}>
                    Aucun assaut ne correspond à ces filtres.
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
