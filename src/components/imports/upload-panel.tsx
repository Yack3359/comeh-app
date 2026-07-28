"use client";

import { Loader2, UploadCloud } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ImportBatch, ImportTarget, Season } from "./types";
import { requestJson } from "./utils";

const acceptedFiles =
  ".pdf,.jpg,.jpeg,.png,.gif,.webp,.xlsx,.xls,application/pdf,image/jpeg,image/png,image/gif,image/webp,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

type UploadPanelProps = {
  target: ImportTarget;
  seasons: Season[];
  onUploaded: (message?: string) => Promise<void>;
};

export function UploadPanel({
  target,
  seasons,
  onUploaded,
}: UploadPanelProps) {
  const [seasonId, setSeasonId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setSeasonId((current) => current || seasons[0]?.id || "");
  }, [seasons]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !seasonId) {
      setError("Sélectionnez une saison et un fichier.");
      return;
    }

    setError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("target", target);
      formData.set("seasonId", seasonId);
      formData.set("file", file);

      const response = await requestJson<ImportBatch>("/api/imports", {
        method: "POST",
        body: formData,
      });
      setFile(null);
      setInputKey((current) => current + 1);
      await onUploaded(response.message);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "L’import a échoué",
      );
    } finally {
      setIsUploading(false);
    }
  }

  const isExpense = target === "expense";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {isExpense ? "Importer des notes de frais" : "Importer des résultats"}
        </CardTitle>
        <CardDescription>
          {isExpense
            ? "Facture PDF ou image avec extraction IA, ou tableau Excel de dépenses."
            : "Feuille de résultats PDF ou image avec extraction IA, ou export Excel structuré."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${target}-season`}>Saison concernée</Label>
              <Select onValueChange={setSeasonId} value={seasonId}>
                <SelectTrigger id={`${target}-season`}>
                  <SelectValue placeholder="Choisir une saison" />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${target}-file`}>Fichier source</Label>
              <Input
                accept={acceptedFiles}
                id={`${target}-file`}
                key={inputKey}
                onChange={(event) =>
                  setFile(event.target.files?.item(0) ?? null)
                }
                required
                type="file"
              />
              <p className="text-xs text-slate-500">
                PDF/images : 15 Mo maximum · Excel : 5 Mo maximum
              </p>
            </div>
          </div>

          {error ? (
            <p
              className="rounded-md border border-accent/20 bg-accent-50 px-3 py-2 text-sm text-accent-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button
              disabled={isUploading || !file || !seasonId}
              type="submit"
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              {isUploading ? "Extraction en cours…" : "Importer et extraire"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

