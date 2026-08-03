"use client";

import { AlertTriangle, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { requestJson } from "@/components/budget/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type EventType = "LOGIN_SUCCESS" | "LOGIN_FAILURE" | "ACCESS_DENIED";

type SecurityEvent = {
  id: string;
  type: EventType;
  email: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  detail: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
};

type SecurityEventsResponse = {
  items: SecurityEvent[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  failedLoginsLast24h: number;
};

const allValue = "__all";

const typeLabels: Record<EventType, string> = {
  LOGIN_SUCCESS: "Connexion réussie",
  LOGIN_FAILURE: "Connexion échouée",
  ACCESS_DENIED: "Accès refusé",
};

const typeStyles: Record<EventType, string> = {
  LOGIN_SUCCESS: "border-transparent bg-emerald-100 text-emerald-800",
  LOGIN_FAILURE: "border-transparent bg-accent-50 text-accent-700",
  ACCESS_DENIED: "border-transparent bg-amber-100 text-amber-800",
};

const typeIcons: Record<EventType, typeof ShieldCheck> = {
  LOGIN_SUCCESS: ShieldCheck,
  LOGIN_FAILURE: ShieldX,
  ACCESS_DENIED: ShieldAlert,
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function SecurityEventsModule() {
  const [type, setType] = useState<EventType | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SecurityEventsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (type) params.set("type", type);
    return params.toString();
  }, [type, page]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    void requestJson<SecurityEventsResponse>(`/api/security-events?${query}`)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger le journal de sécurité",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-institutional">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-y-0 right-0 w-2 bg-accent" />
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-blue-100">
            Administration
          </p>
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-7 w-7" />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Journal de sécurité
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
            Connexions, échecs de connexion et accès refusés — pour repérer
            une activité suspecte.
          </p>
        </div>
      </section>

      {data && data.failedLoginsLast24h >= 5 ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">
              {data.failedLoginsLast24h} échecs de connexion
            </span>{" "}
            enregistrés au cours des dernières 24 heures — vérifiez qu’il ne
            s’agit pas d’une tentative d’intrusion.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-xl">Événements enregistrés</CardTitle>
            <CardDescription>
              {data
                ? `${data.pagination.total.toLocaleString("fr-FR")} événement${
                    data.pagination.total > 1 ? "s" : ""
                  }`
                : "Chargement…"}
            </CardDescription>
          </div>
          <div className="w-56 space-y-1">
            <Select
              onValueChange={(value) => {
                setType(value === allValue ? "" : (value as EventType));
                setPage(1);
              }}
              value={type || allValue}
            >
              <SelectTrigger aria-label="Filtrer par type d’événement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allValue}>Tous les types</SelectItem>
                {(Object.keys(typeLabels) as EventType[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {typeLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="rounded-lg bg-accent-50 p-4 text-sm text-accent-700">
              {error}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Utilisateur / e-mail</TableHead>
                  <TableHead>Adresse IP</TableHead>
                  <TableHead>Détail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((event) => {
                  const Icon = typeIcons[event.type];
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {formatDateTime(event.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge className={typeStyles[event.type]}>
                          <Icon className="mr-1 h-3.5 w-3.5" />
                          {typeLabels[event.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {event.user ? (
                          <>
                            <p className="font-medium text-slate-900">
                              {event.user.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {event.user.email}
                            </p>
                          </>
                        ) : (
                          <p className="text-slate-600">
                            {event.email ?? "—"}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.ipAddress ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-64 text-sm text-slate-600">
                        {event.detail ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isLoading && data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="py-10 text-center text-slate-500"
                      colSpan={5}
                    >
                      Aucun événement ne correspond à ces filtres.
                    </TableCell>
                  </TableRow>
                ) : null}
                {isLoading && !data ? (
                  <TableRow>
                    <TableCell
                      className="py-10 text-center text-slate-500"
                      colSpan={5}
                    >
                      Chargement du journal…
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}

          {data ? (
            <div className="mt-5 flex items-center justify-between gap-4">
              <p className="text-sm text-slate-500">
                Page {data.pagination.page} sur {data.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={isLoading || page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Précédent
                </Button>
                <Button
                  disabled={isLoading || page >= data.pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Suivant
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
