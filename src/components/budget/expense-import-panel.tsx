"use client";

import { FileSearch, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ImportBatchCard } from "@/components/imports/import-batch-card";
import { UploadPanel } from "@/components/imports/upload-panel";
import type { ImportBatch } from "@/components/imports/types";
import {
  isImportEnvelope,
  requestJson as requestImportJson,
} from "@/components/imports/utils";

import type { Season } from "./types";

type ExpenseImportPanelProps = {
  seasons: Season[];
  onChanged: () => void;
};

export function ExpenseImportPanel({
  seasons,
  onChanged,
}: ExpenseImportPanelProps) {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    const imports = await requestImportJson<ImportBatch[]>("/api/imports");
    setBatches(
      imports.filter(
        (batch) =>
          isImportEnvelope(batch.extraction) &&
          batch.extraction.target === "expense",
      ),
    );
  }, []);

  useEffect(() => {
    setIsLoading(true);
    void loadBatches()
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les imports",
        );
      })
      .finally(() => setIsLoading(false));
  }, [loadBatches]);

  async function refresh(successMessage?: string) {
    setError(null);
    try {
      await loadBatches();
      setMessage(
        successMessage ??
          "Fichier importé. Relisez les données avant validation.",
      );
      onChanged();
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible d’actualiser les imports",
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-slate-50 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            Importer un justificatif
          </p>
          <Badge variant="outline">Excel ou photo</Badge>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Déposez un ticket, une facture (photo) ou un tableur de dépenses :
          les informations sont extraites automatiquement pour compléter la
          note de frais, que vous validez ensuite ligne par ligne.
        </p>
        <UploadPanel onUploaded={refresh} seasons={seasons} target="expense" />
      </div>

      {error ? (
        <p
          className="rounded-md border border-accent/20 bg-accent-50 p-3 text-sm text-accent-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Imports à relire
          </h2>
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <FileSearch className="h-4 w-4" />
            Comparez chaque extraction au fichier original avant validation.
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
            Aucun import de note de frais pour le moment.
          </div>
        ) : null}

        {batches.map((batch) => (
          <ImportBatchCard
            batch={batch}
            key={batch.id}
            onValidated={() =>
              refresh("Les frais sélectionnés ont été enregistrés.")
            }
            seasons={seasons}
          />
        ))}
      </div>
    </div>
  );
}
