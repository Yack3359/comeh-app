"use client";

import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { BudgetCategory } from "./types";
import { requestJson } from "./utils";

type CategoryManagerProps = {
  seasonId: string;
  canManage: boolean;
  version: number;
  onChanged: () => void;
};

export function CategoryManager({
  seasonId,
  canManage,
  version,
  onChanged,
}: CategoryManagerProps) {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    if (!seasonId) {
      setCategories([]);
      return;
    }

    try {
      setError(null);
      setCategories(
        await requestJson<BudgetCategory[]>(
          `/api/budget-categories?seasonId=${encodeURIComponent(seasonId)}`,
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Chargement impossible",
      );
    }
  }, [seasonId]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories, version]);

  async function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      await requestJson("/api/budget-categories", {
        method: "POST",
        body: JSON.stringify({ seasonId, name }),
      });
      setName("");
      await loadCategories();
      onChanged();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Création impossible",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function updateCategory(id: string) {
    setIsPending(true);
    setError(null);

    try {
      await requestJson(`/api/budget-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editingName }),
      });
      setEditingId(null);
      await loadCategories();
      onChanged();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Modification impossible",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function deleteCategory(category: BudgetCategory) {
    if (
      !window.confirm(
        `Supprimer la catégorie « ${category.name} » et son budget prévisionnel ?`,
      )
    ) {
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      await requestJson(`/api/budget-categories/${category.id}`, {
        method: "DELETE",
      });
      await loadCategories();
      onChanged();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Suppression impossible",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Catégories de budget</CardTitle>
        <CardDescription>
          Les catégories sont propres à chaque saison et structurent le budget
          ainsi que les notes de frais.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {canManage ? (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={createCategory}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="category-name">Nouvelle catégorie</Label>
              <Input
                id="category-name"
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex. Équipe de France, stages, matériel"
                required
                value={name}
              />
            </div>
            <Button disabled={isPending || !seasonId} type="submit">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter
            </Button>
          </form>
        ) : null}

        {error ? (
          <p
            aria-live="polite"
            className="rounded-md border border-accent/20 bg-accent-50 px-3 py-2 text-sm text-accent-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead className="text-right">Frais saisis</TableHead>
              {canManage ? (
                <TableHead className="w-32 text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">
                  {editingId === category.id ? (
                    <Input
                      aria-label={`Nom de la catégorie ${category.name}`}
                      autoFocus
                      maxLength={80}
                      onChange={(event) => setEditingName(event.target.value)}
                      value={editingName}
                    />
                  ) : (
                    category.name
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {category._count.expenses}
                </TableCell>
                {canManage ? (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {editingId === category.id ? (
                        <>
                          <Button
                            aria-label="Enregistrer"
                            disabled={isPending || editingName.trim().length < 2}
                            onClick={() => void updateCategory(category.id)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            aria-label="Annuler"
                            onClick={() => setEditingId(null)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            aria-label={`Modifier ${category.name}`}
                            onClick={() => {
                              setEditingId(category.id);
                              setEditingName(category.name);
                            }}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            aria-label={`Supprimer ${category.name}`}
                            disabled={isPending}
                            onClick={() => void deleteCategory(category)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4 text-accent" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
            {categories.length === 0 ? (
              <TableRow>
                <TableCell
                  className="py-10 text-center text-slate-500"
                  colSpan={canManage ? 3 : 2}
                >
                  Aucune catégorie pour cette saison.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

