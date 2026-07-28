"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ExpenseReview } from "./expense-review";
import { ResultReview } from "./result-review";
import type { ImportBatch, Season } from "./types";
import { formatDate, isImportEnvelope } from "./utils";

type ImportBatchCardProps = {
  batch: ImportBatch;
  seasons: Season[];
  onValidated: () => Promise<void>;
};

const statusLabels = {
  PENDING: "En traitement",
  EXTRACTED: "À relire",
  VALIDATED: "Validé",
  FAILED: "Échec",
} as const;

export function ImportBatchCard({
  batch,
  seasons,
  onValidated,
}: ImportBatchCardProps) {
  const envelope = isImportEnvelope(batch.extraction)
    ? batch.extraction
    : null;
  const season = seasons.find((item) => item.id === envelope?.seasonId);
  const SourceIcon =
    batch.sourceType === "EXCEL"
      ? FileSpreadsheet
      : batch.sourceType === "IMAGE"
        ? ImageIcon
        : FileText;
  const StatusIcon =
    batch.status === "VALIDATED"
      ? CheckCircle2
      : batch.status === "FAILED"
        ? AlertTriangle
        : Clock3;

  return (
    <Card className={batch.status === "FAILED" ? "border-accent/30" : ""}>
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between md:space-y-0">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              className={
                batch.status === "FAILED"
                  ? "border-accent/30 bg-accent-50 text-accent-700"
                  : batch.status === "VALIDATED"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : ""
              }
              variant={batch.status === "EXTRACTED" ? "default" : "outline"}
            >
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusLabels[batch.status]}
            </Badge>
            <Badge variant="secondary">
              {envelope?.target === "result"
                ? "Résultats sportifs"
                : "Notes de frais"}
            </Badge>
          </div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <SourceIcon className="h-5 w-5 text-primary" />
            {envelope?.originalName ?? "Fichier d’import"}
          </CardTitle>
          <CardDescription className="mt-1">
            {season ? `Saison ${season.label} · ` : ""}
            importé le {formatDate(batch.createdAt)}
            {envelope?.rows.length
              ? ` · ${envelope.rows.length} ligne${
                  envelope.rows.length > 1 ? "s" : ""
                }`
              : ""}
          </CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={batch.fileUrl} rel="noreferrer" target="_blank">
            Fichier original
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </a>
        </Button>
      </CardHeader>
      <CardContent>
        {!envelope ? (
          <p className="rounded-md border border-accent/20 bg-accent-50 p-3 text-sm text-accent-700">
            Les métadonnées de cet import sont illisibles.
          </p>
        ) : null}

        {envelope && batch.status === "FAILED" ? (
          <p
            className="rounded-md border border-accent/20 bg-accent-50 p-3 text-sm text-accent-700"
            role="alert"
          >
            {envelope.error ?? "L’extraction de ce fichier a échoué."}
          </p>
        ) : null}

        {envelope && batch.status === "PENDING" ? (
          <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Le fichier est en cours de traitement ou de validation.
          </p>
        ) : null}

        {envelope && batch.status === "VALIDATED" ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Toutes les lignes ont été enregistrées avec succès.
          </p>
        ) : null}

        {envelope &&
        batch.status === "EXTRACTED" &&
        envelope.target === "expense" ? (
          <ExpenseReview
            batchId={batch.id}
            envelope={envelope}
            onValidated={onValidated}
          />
        ) : null}

        {envelope &&
        batch.status === "EXTRACTED" &&
        envelope.target === "result" ? (
          <ResultReview
            batchId={batch.id}
            envelope={envelope}
            onValidated={onValidated}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

