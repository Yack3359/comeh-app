"use client";

import { FileSearch, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { ImportBatchCard } from "./import-batch-card";
import { UploadPanel } from "./upload-panel";
import type { ImportBatch, Season } from "./types";
import { requestJson } from "./utils";

export function ImportsModule() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    const imports = await requestJson<ImportBatch[]>("/api/imports");
    setBatches(imports);
  }, []);

  useEffect(() => {
    void Promise.all([
      requestJson<Season[]>("/api/seasons"),
      requestJson<ImportBatch[]>("/api/imports"),
    ])
      .then(([loadedSeasons, loadedBatches]) => {
        setSeasons(loadedSeasons);
        setBatches(loadedBatches);
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les imports",
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function refresh(successMessage?: string) {
    setError(null);
    try {
      await loadBatches();
      setMessage(
        successMessage ??
          "Import enregistré. Relisez les données avant validation.",
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible d’actualiser les imports",
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-institutional">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-y-0 right-0 w-2 bg-accent" />
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-100">
                  Import assisté
                </p>
                <Badge
                  className="border-white/30 bg-white/10 text-white"
                  variant="outline"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  IA + Excel
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Extraire, relire, puis enregistrer
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                Les documents restent privés. Aucune dépense ni aucun résultat
                n’est créé avant votre validation explicite.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-sm text-blue-50">
              <FileSearch className="h-5 w-5" />
              Comparez chaque extraction au fichier original.
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <p
          className="rounded-xl border border-accent/20 bg-accent-50 p-4 text-sm text-accent-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <Tabs defaultValue="expense">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1">
          <TabsTrigger value="expense">Notes de frais</TabsTrigger>
          <TabsTrigger value="result">Résultats sportifs</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-5" value="expense">
          <UploadPanel
            onUploaded={refresh}
            seasons={seasons}
            target="expense"
          />
        </TabsContent>
        <TabsContent className="mt-5" value="result">
          <UploadPanel
            onUploaded={refresh}
            seasons={seasons}
            target="result"
          />
        </TabsContent>
      </Tabs>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Imports à relire
          </h2>
          <p className="text-sm text-slate-500">
            Les imports en échec restent visibles et n’empêchent pas les
            validations suivantes.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-xl border bg-card py-12 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Chargement des imports…
          </div>
        ) : null}

        {!isLoading && batches.length === 0 ? (
          <div className="rounded-xl border bg-card py-12 text-center text-sm text-slate-500">
            Aucun import pour le moment.
          </div>
        ) : null}

        {batches.map((batch) => (
          <ImportBatchCard
            batch={batch}
            key={batch.id}
            onDeleted={() => refresh("Import supprimé.")}
            onValidated={() =>
              refresh("Les données sélectionnées ont été enregistrées.")
            }
            seasons={seasons}
          />
        ))}
      </section>
    </div>
  );
}
