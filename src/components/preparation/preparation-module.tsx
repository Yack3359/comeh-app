"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BudgetConstruction } from "@/components/budget-construction";
import { ErrorMessage, FieldSelect, pilotageRequest } from "@/components/pilotage/shared";
import { PreparationProgress } from "./preparation-progress";
import { PreparationLines } from "./preparation-lines";
import type { PreparationData } from "./types";

const viewTitles = { avancement: "Avancement", lignes: "Compétitions et stages", construction: "Construction du budget" };
type Props = { canPrepare: boolean; canDecide: boolean; isAdmin: boolean };
export function PreparationModule(props: Props) {
  return <Suspense fallback={null}><PreparationModuleContent {...props} /></Suspense>;
}
function PreparationModuleContent({ canPrepare, canDecide, isAdmin }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("vue") ?? "avancement";
  const view = Object.prototype.hasOwnProperty.call(viewTitles, requested) ? requested as keyof typeof viewTitles : "avancement";
  const year = searchParams.get("fiscalYear") ?? "";
  const team = searchParams.get("equipe") ?? "all";
  const activeYear = useRef("");
  const [data, setData] = useState<PreparationData | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includePending, setIncludePending] = useState(false);
  const label = data?.fiscalYear.label ?? (year || String(new Date().getFullYear() + 1));
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setMissing(false); setData(null);
    const requestedYear = year || activeYear.current;
    void fetch("/api/budget-preparation" + (requestedYear ? "?fiscalYear=" + encodeURIComponent(requestedYear) : ""), { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 404) { setMissing(true); return; }
        if (!response.ok) throw new Error(body?.error || "Impossible de charger la préparation");
        setData(body as PreparationData); activeYear.current = (body as PreparationData).fiscalYear.label;
      }).catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Impossible de charger la préparation"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [year, version]);
  function changeView(next: keyof typeof viewTitles, nextTeam = team, nextYear = label) {
    const params = new URLSearchParams(searchParams.toString()); params.set("vue", next); params.set("fiscalYear", nextYear);
    if (nextTeam === "all") params.delete("equipe"); else params.set("equipe", nextTeam);
    router.replace("/preparation?" + params.toString(), { scroll: false });
  }
  async function open(copyFromPrevious: boolean) {
    setBusy(true); setError(null);
    try { await pilotageRequest("/api/budget-preparation/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fiscalYearLabel: label, copyFromPrevious }) }); setVersion(value => value + 1); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Impossible d’ouvrir la préparation"); }
    finally { setBusy(false); }
  }
  return <div className="min-w-0 space-y-6" aria-busy={loading || busy}>
    <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-institutional"><div className="relative px-6 py-7 sm:px-8"><div className="absolute inset-y-0 right-0 w-2 bg-accent" />
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div className="max-w-3xl space-y-3"><div className="flex items-center gap-2"><p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-100">Préparer le budget</p>{!canPrepare && <Badge variant="outline" className="border-white/30 text-white">Lecture seule</Badge>}</div>
        <h1 className="text-2xl font-bold sm:text-3xl">Préparer le budget {label}</h1><p className="text-sm leading-6 text-blue-100">{data?.posts.length ? data.progress.headline : "Ouvrez la trame pour préparer ensemble les compétitions et les stages de l’année à venir."}</p>
        {data?.posts.length ? <><progress className="h-3 w-full accent-emerald-400" value={data.progress.percent} max={100} aria-label="Avancement global" /><p className="text-xs">{data.progress.percent} % · Échéance : {data.fiscalYear.preparationDeadline ? new Date(data.fiscalYear.preparationDeadline).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "à définir"}</p></> : null}
      </div><div className="w-full shrink-0 rounded-xl bg-white/10 p-3 lg:w-64">{data ? <FieldSelect id="preparation-year" label="Exercice" value={label} disabled={loading || busy} onChange={next => changeView(view, "all", next)} options={data.fiscalYears.map(item => ({ value: item.label, label: item.label }))} /> : <p className="text-xl font-bold">Exercice {label}</p>}</div></div>
    </div></section>
    <details className="rounded-xl border bg-white p-5 text-sm"><summary className="cursor-pointer font-semibold text-primary">Comment ça marche</summary><ol className="mt-3 list-decimal space-y-2 pl-5"><li>Confirmez les compétitions et les stages de chaque équipe.</li><li>Chiffrez les coûts et la prise en charge FFE, en vous aidant de l’année précédente.</li><li>Arbitrez les propositions pour tenir dans l’enveloppe prévue.</li><li>Votez le budget pour commencer le suivi des dépenses.</li></ol></details>
    <ErrorMessage message={error} />{error && <Button variant="outline" onClick={() => setVersion(value => value + 1)}>Réessayer</Button>}
    {loading && <p role="status" className="p-6 text-slate-500">Chargement de la préparation…</p>}
    {!loading && (missing || data?.canOpen) && <Card><CardContent className="space-y-4 p-8 text-center"><h2 className="text-xl font-bold text-primary">Ouvrir la préparation du budget {label}</h2>
      {canDecide ? <div className="flex flex-wrap justify-center gap-3"><Button disabled={busy} onClick={() => void open(true)}>Repartir des actions {Number(label) - 1}</Button><Button disabled={busy} variant="outline" onClick={() => void open(false)}>Partir d’une trame vide</Button></div> : <p>La commission ouvrira prochainement la préparation du budget.</p>}
    </CardContent></Card>}
    {data && !loading && !data.canOpen && !data.posts.length && <Card><CardContent className="p-8 text-center">La trame ne peut pas encore être ouverte : aucun poste n’est disponible sur l’exercice précédent.</CardContent></Card>}
    {data && !loading && !!data.posts.length && <>
      {data.fiscalYear.phase === "EXECUTION" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><p className="font-bold text-emerald-800">Budget voté — lecture seule</p><Link className="mt-2 inline-block text-sm underline" href={"/pilotage?fiscalYear=" + label}>Ouvrir le suivi du budget {label}</Link></div>}
      <div className="flex flex-wrap gap-2" aria-label="Vues de la préparation">{Object.entries(viewTitles).map(([value, title]) => <Button key={value} variant={view === value ? "default" : "outline"} aria-pressed={view === value} onClick={() => changeView(value as keyof typeof viewTitles)}>{title}</Button>)}</div>
      <h2 className="text-xl font-bold text-primary">{viewTitles[view]}</h2>
      {view === "avancement" && <PreparationProgress key={data.fiscalYear.id + ":" + version} data={data} canDecide={canDecide} isAdmin={isAdmin} onTeam={team => changeView("lignes", team)} onChanged={() => setVersion(value => value + 1)} />}
      {view === "lignes" && <PreparationLines data={data} canPrepare={canPrepare} team={team} onTeam={team => changeView("lignes", team)} onChanged={() => setVersion(value => value + 1)} />}
      {view === "construction" && <BudgetConstruction data={includePending ? data.construction.high : data.construction.retained} includePending={includePending} onIncludePending={data.fiscalYear.phase === "PREPARATION" ? setIncludePending : undefined} />}
    </>}
  </div>;
}
