"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
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

import type { Competition } from "./types";
import { requestJson } from "./utils";

type FfeExportPanelProps = {
  seasonId: string;
};

export function FfeExportPanel({ seasonId }: FfeExportPanelProps) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    setCompetitionId("");
    setError(null);

    if (!seasonId) {
      setCompetitions([]);
      setIsLoading(false);
      return () => {
        ignore = true;
      };
    }

    setIsLoading(true);
    void requestJson<Competition[]>(
      `/api/competitions?seasonId=${encodeURIComponent(seasonId)}`,
    )
      .then((data) => {
        if (!ignore) {
          setCompetitions(data);
        }
      })
      .catch((loadError: unknown) => {
        if (!ignore) {
          setCompetitions([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les compétitions",
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [seasonId]);

  if (!seasonId || (!isLoading && competitions.length === 0 && !error)) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-slate-500">
        Aucune compétition pour cette saison.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exporter une note de frais FFE</CardTitle>
        <CardDescription>
          Sélectionnez la compétition à reporter dans le modèle officiel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <p className="rounded-md bg-accent-50 p-3 text-sm text-accent-700">
            {error}
          </p>
        ) : null}

        <div className="max-w-xl space-y-2">
          <Label htmlFor="ffe-export-competition">Compétition</Label>
          <Select
            disabled={isLoading || competitions.length === 0}
            onValueChange={setCompetitionId}
            value={competitionId}
          >
            <SelectTrigger id="ffe-export-competition">
              <SelectValue
                placeholder={
                  isLoading
                    ? "Chargement des compétitions…"
                    : "Choisir une compétition"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {competitions.map((competition) => (
                <SelectItem key={competition.id} value={competition.id}>
                  {competition.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {competitionId ? (
          <Button asChild>
            <a
              download
              href={`/api/expenses/export-ffe?competitionId=${encodeURIComponent(competitionId)}`}
            >
              <Download className="mr-2 h-4 w-4" />
              Télécharger la note de frais FFE
            </a>
          </Button>
        ) : null}

        <p className="text-sm leading-6 text-slate-500">
          Les champs non disponibles dans l&apos;application (bénéficiaire,
          kilomètres, indemnités d&apos;arbitrage) restent à compléter à la
          main.
        </p>
      </CardContent>
    </Card>
  );
}
