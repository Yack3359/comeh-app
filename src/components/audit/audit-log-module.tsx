"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  ScrollText,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requestJson } from "@/components/budget/utils";

type AuditUser = {
  id: string;
  name: string;
  email: string;
};

type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  diffJson: unknown;
  createdAt: string;
  user: AuditUser;
};

type AuditResponse = {
  items: AuditItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    users: AuditUser[];
    entityTypes: string[];
  };
};

type AuditFilters = {
  userId: string;
  entityType: string;
  from: string;
  to: string;
};

const allValue = "__all";
const emptyFilters: AuditFilters = {
  userId: "",
  entityType: "",
  from: "",
  to: "",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function jsonSection(diffJson: unknown, key: "before" | "after" | "input") {
  if (
    !diffJson ||
    typeof diffJson !== "object" ||
    Array.isArray(diffJson) ||
    !(key in diffJson)
  ) {
    return undefined;
  }

  return (diffJson as Record<string, unknown>)[key];
}

function PrettyJson({ value }: { value: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
      {JSON.stringify(value, null, 2) ?? "null"}
    </pre>
  );
}

export function AuditLogModule() {
  const [draftFilters, setDraftFilters] =
    useState<AuditFilters>(emptyFilters);
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters, page]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    void requestJson<AuditResponse>(`/api/audit?${query}`)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger le journal d’audit",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters(draftFilters);
  }

  function resetFilters() {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-institutional">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-y-0 right-0 w-2 bg-accent" />
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-blue-100">
            Administration
          </p>
          <div className="flex items-center gap-3">
            <ScrollText className="h-7 w-7" />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Journal d’audit
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
            Consultez les opérations enregistrées, leur auteur et les données
            modifiées.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Filter className="h-5 w-5 text-primary" />
            Filtres
          </CardTitle>
          <CardDescription>
            Affinez la liste par utilisateur, entité ou période.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={applyFilters}
          >
            <div className="space-y-2">
              <Label htmlFor="audit-user">Utilisateur</Label>
              <Select
                onValueChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    userId: value === allValue ? "" : value,
                  }))
                }
                value={draftFilters.userId || allValue}
              >
                <SelectTrigger id="audit-user">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={allValue}>Tous les utilisateurs</SelectItem>
                  {(data?.filters.users ?? []).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} · {user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-entity">Type d’entité</Label>
              <Select
                onValueChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    entityType: value === allValue ? "" : value,
                  }))
                }
                value={draftFilters.entityType || allValue}
              >
                <SelectTrigger id="audit-entity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={allValue}>Toutes les entités</SelectItem>
                  {(data?.filters.entityTypes ?? []).map((entityType) => (
                    <SelectItem key={entityType} value={entityType}>
                      {entityType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-from">Du</Label>
              <Input
                id="audit-from"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
                type="date"
                value={draftFilters.from}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-to">Au</Label>
              <Input
                id="audit-to"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
                type="date"
                value={draftFilters.to}
              />
            </div>

            <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
              <Button disabled={isLoading} type="submit">
                Appliquer les filtres
              </Button>
              <Button
                onClick={resetFilters}
                type="button"
                variant="outline"
              >
                Réinitialiser
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="text-xl">Opérations enregistrées</CardTitle>
            <CardDescription>
              {data
                ? `${data.pagination.total.toLocaleString("fr-FR")} entrée${
                    data.pagination.total > 1 ? "s" : ""
                  }`
                : "Chargement…"}
            </CardDescription>
          </div>
          <CalendarDays className="h-5 w-5 text-primary" />
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
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entité</TableHead>
                  <TableHead>Identifiant</TableHead>
                  <TableHead>Modifications</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((item) => {
                  const before = jsonSection(item.diffJson, "before");
                  const after = jsonSection(item.diffJson, "after");
                  const input = jsonSection(item.diffJson, "input");

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {formatDateTime(item.createdAt)}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-900">
                          {item.user.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.user.email}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {item.action}
                      </TableCell>
                      <TableCell>{item.entityType}</TableCell>
                      <TableCell className="max-w-36 break-all font-mono text-xs">
                        {item.entityId}
                      </TableCell>
                      <TableCell className="min-w-52">
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold text-primary hover:underline">
                            Voir avant / après
                          </summary>
                          <div className="mt-3 grid min-w-[32rem] gap-3">
                            <div>
                              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                                Avant
                              </p>
                              <PrettyJson value={before ?? null} />
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                                Après
                              </p>
                              <PrettyJson value={after ?? null} />
                            </div>
                            {input !== undefined ? (
                              <div>
                                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Entrée groupée
                                </p>
                                <PrettyJson value={input} />
                              </div>
                            ) : null}
                          </div>
                        </details>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isLoading && data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="py-10 text-center text-slate-500"
                      colSpan={6}
                    >
                      Aucune opération ne correspond à ces filtres.
                    </TableCell>
                  </TableRow>
                ) : null}
                {isLoading && !data ? (
                  <TableRow>
                    <TableCell
                      className="py-10 text-center text-slate-500"
                      colSpan={6}
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
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Précédent
                </Button>
                <Button
                  disabled={
                    isLoading || page >= data.pagination.totalPages
                  }
                  onClick={() => setPage((current) => current + 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Suivant
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
