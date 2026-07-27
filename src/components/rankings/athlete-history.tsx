"use client";

import { CalendarRange, Medal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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

import type { Athlete, AthleteHistoryData } from "./types";
import { athleteName, formatDate, requestJson } from "./utils";

type AthleteHistoryProps = {
  version: number;
};

export function AthleteHistory({ version }: AthleteHistoryProps) {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [history, setHistory] = useState<AthleteHistoryData | null>(null);
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

  const loadHistory = useCallback(async () => {
    if (!athleteId) {
      setHistory(null);
      return;
    }
    setHistory(
      await requestJson<AthleteHistoryData>(
        `/api/athletes/${athleteId}/history`,
      ),
    );
  }, [athleteId]);

  useEffect(() => {
    setError(null);
    void loadHistory().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    });
  }, [loadHistory, version]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Historique athlète</CardTitle>
          <CardDescription>
            Suivez les changements de catégorie et les classements finaux saison
            après saison.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label htmlFor="history-athlete">Athlète</Label>
            <Select onValueChange={setAthleteId} value={athleteId}>
              <SelectTrigger id="history-athlete">
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

      {history?.seasons.map((season, index) => (
        <Card className="overflow-hidden" key={season.id}>
          <div className="border-l-4 border-primary">
            <CardHeader>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <CalendarRange className="h-5 w-5 text-primary" />
                    Saison {season.label}
                  </CardTitle>
                  <CardDescription>
                    {formatDate(season.startDate)} – {formatDate(season.endDate)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {index === 0 ? <Badge>Saison la plus récente</Badge> : null}
                  <Badge variant="outline">
                    {season.category || "Catégorie non renseignée"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compétition</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Niveau</TableHead>
                    <TableHead className="text-right">Classement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {season.rankings.map((ranking) => (
                    <TableRow key={ranking.id}>
                      <TableCell className="font-medium">
                        {ranking.competition.name}
                      </TableCell>
                      <TableCell>{formatDate(ranking.competition.date)}</TableCell>
                      <TableCell>{ranking.competition.level}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 font-bold text-primary">
                          <Medal className="h-4 w-4" />
                          {ranking.rank}
                          {ranking.rank === 1 ? "er" : "e"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {season.rankings.length === 0 ? (
                    <TableRow>
                      <TableCell
                        className="py-8 text-center text-slate-500"
                        colSpan={4}
                      >
                        Aucun classement final pour cette saison.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </div>
        </Card>
      ))}

      {history && history.seasons.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-slate-500">
            Aucune catégorie ni classement final n’est encore enregistré pour cet
            athlète.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
