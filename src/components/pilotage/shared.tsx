"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { flagLabels } from "@/lib/budget-pilotage-labels";
import type { Flag } from "@/lib/budget-pilotage";

export const flagStyles: Record<Flag, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  orange: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-accent/20 bg-accent-50 text-accent-700",
};
export function FlagBadge({ flag }: { flag: Flag }) {
  return <Badge variant="outline" className={flagStyles[flag]}>{flagLabels[flag]}</Badge>;
}
export function ErrorMessage({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-lg border border-accent/20 bg-accent-50 p-3 text-sm text-accent-700">{message}</p> : null;
}
export function FieldSelect({ id, label, value, onChange, options, disabled = false }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>; disabled?: boolean;
}) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}
export function Popup({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" data-print-hide onClick={() => !busy && onClose()}>
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="pilotage-dialog-title"
      className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-institutional"
      onClick={event => event.stopPropagation()} onKeyDown={event => {
        if (event.key === "Escape" && !busy) { event.stopPropagation(); onClose(); }
        if (event.key !== "Tab") return;
        const items = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
        if (!items?.length) { event.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <div className="mb-5 flex items-center justify-between gap-3"><h2 id="pilotage-dialog-title" className="text-xl font-bold text-primary">{title}</h2>
        <Button type="button" variant="ghost" size="icon" aria-label="Fermer" onClick={onClose} disabled={busy}><X className="h-5 w-5" /></Button>
      </div>{children}
    </div>
  </div>;
}
// Both JSON and multipart requests surface the API's French field-level errors.
export async function pilotageRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const details = body?.details ? Object.values(body.details).flat().filter(value => typeof value === "string").join(" — ") : "";
    throw new Error(details || body?.error || "Une erreur est survenue. Veuillez réessayer.");
  }
  return body as T;
}
