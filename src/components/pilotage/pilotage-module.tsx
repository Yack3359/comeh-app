"use client";

import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/components/budget/utils";
import { ErrorMessage, FieldSelect, pilotageRequest } from "./shared";
import { PilotageSummary } from "./pilotage-summary";
import { PilotageActions } from "./pilotage-actions";
import { PilotageImport } from "./pilotage-import";
import { PilotageHistory } from "./pilotage-history";
import type { ImportResult, PilotageData } from "./types";

export function PilotageModule({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<PilotageData | null>(null);
  const [year, setYear] = useState("");
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState("summary");
  const [postCode, setPostCode] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const activeYear = useRef("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const label = year || activeYear.current;
    void pilotageRequest<PilotageData>("/api/pilotage" + (label ? "?fiscalYear=" + encodeURIComponent(label) : ""), { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setData(result); activeYear.current = result.fiscalYear.label; } })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Impossible de charger le pilotage budgétaire"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [year, version]);
  function imported(label: string, result: ImportResult) {
    setNotice("Import terminé : " + result.created + " nouvelles, " + result.updated + " modifiées, " + result.unchanged + " inchangées, " + result.missing + " absentes (conservées).");
    setYear(label); setVersion(value => value + 1); setPostCode("all"); setTab("summary");
  }
  return <div className="min-w-0 space-y-6" aria-busy={loading}>
    <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-institutional">
      <div className="relative px-6 py-7 sm:px-8"><div className="absolute inset-y-0 right-0 w-2 bg-accent" />
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div><div className="mb-2 flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-100">Module Pilotage budgétaire</p>
            {!canManage && <Badge variant="outline" className="border-white/30 bg-white/10 text-white"><Eye className="mr-1 h-3 w-3" />Lecture seule</Badge>}
          </div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Piloter le budget de la commission</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Budget, réalisé et atterrissage de la part FFE, par poste et par action, à partir de la matrice du contrôleur de gestion.</p>
          </div>
          <div className="w-full shrink-0 rounded-xl bg-white/10 p-3 backdrop-blur-sm lg:w-72">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Exercice</p><p className="mt-0.5 text-2xl font-bold">{year || data?.fiscalYear.label || "—"}</p>
            {data && <div className="mt-2" data-print-hide><FieldSelect id="pilotage-year" label="Changer d’exercice" value={year || data.fiscalYear.label} disabled={loading}
              onChange={label => { setYear(label); setPostCode("all"); setNotice(""); }} options={data.fiscalYears.map(item => ({ value: item.label, label: item.label }))} /></div>}
            <p className="mt-2 text-xs text-blue-100">{loading ? "Chargement…" : data?.snapshots.length ? "Situation au " + formatDate(data.asOfDate) : "Aucun import"}</p>
          </div>
        </div>
      </div>
    </section>
    <ErrorMessage message={error} />
    {error && <Button data-print-hide variant="outline" onClick={() => setVersion(value => value + 1)}>Réessayer</Button>}
    {notice && <p role="status" data-print-hide className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    {loading && <p role="status" className="p-6 text-slate-500">Chargement du pilotage budgétaire…</p>}
    {data && !loading && !error && <>
      {!data.posts.length && <Card className="shadow-institutional"><CardContent className="space-y-4 p-8 text-center"><p>Aucune matrice importée pour {data.fiscalYear.label}</p>
        {canManage && <Button data-print-hide onClick={() => setTab("import")}>Importer la matrice</Button>}
      </CardContent></Card>}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-print-hide className="flex h-auto w-full flex-wrap gap-1 p-1"><TabsTrigger value="summary">Synthèse</TabsTrigger><TabsTrigger value="actions">Actions</TabsTrigger>
          {canManage && <TabsTrigger value="import">Importer la matrice</TabsTrigger>}<TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-5"><PilotageSummary data={data} onPost={code => { setPostCode(code); setTab("actions"); }} /></TabsContent>
        <TabsContent value="actions" className="mt-5"><PilotageActions data={data} canManage={canManage} postCode={postCode} onPostChange={setPostCode} onChanged={() => setVersion(value => value + 1)} /></TabsContent>
        {canManage && <TabsContent value="import" className="mt-5"><PilotageImport onImported={imported} /></TabsContent>}
        <TabsContent value="history" className="mt-5"><PilotageHistory data={data} /></TabsContent>
      </Tabs>
    </>}
  </div>;
}
