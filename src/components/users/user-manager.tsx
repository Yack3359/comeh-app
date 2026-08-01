"use client";

import {
  Check,
  Clipboard,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  UserCheck,
  UserCog,
  UserX,
  X,
} from "lucide-react";
import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";

import { requestJson } from "@/components/budget/utils";
import { Badge } from "@/components/ui/badge";
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

type UserRole = "ADMIN" | "COMEH_MEMBER" | "READONLY";

type ManagedUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  disabled: boolean;
  createdAt: string;
};

type UserManagerProps = {
  currentUserId: string;
};

const roles: UserRole[] = ["ADMIN", "COMEH_MEMBER", "READONLY"];
const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrateur",
  COMEH_MEMBER: "Membre COMEH",
  READONLY: "Lecture seule",
};
const roleClasses: Record<UserRole, string> = {
  ADMIN: "border-transparent bg-primary text-primary-foreground",
  COMEH_MEMBER: "border-transparent bg-emerald-100 text-emerald-800",
  READONLY: "border-transparent bg-slate-100 text-slate-700",
};

function secureRandomIndex(max: number) {
  const upperBound = Math.floor(0x100000000 / max) * max;
  const randomValue = new Uint32Array(1);

  do {
    crypto.getRandomValues(randomValue);
  } while (randomValue[0] >= upperBound);

  return randomValue[0] % max;
}

function generateStrongPassword() {
  const characterSets = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
  ];
  const allCharacters = characterSets.join("");
  const characters = characterSets.map(
    (set) => set[secureRandomIndex(set.length)],
  );

  while (characters.length < 18) {
    characters.push(allCharacters[secureRandomIndex(allCharacters.length)]);
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const otherIndex = secureRandomIndex(index + 1);
    [characters[index], characters[otherIndex]] = [
      characters[otherIndex],
      characters[index],
    ];
  }

  return characters.join("");
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export function UserManager({ currentUserId }: UserManagerProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("COMEH_MEMBER");
  const [password, setPassword] = useState("");
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingRole, setEditingRole] = useState<UserRole>("COMEH_MEMBER");
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [completedResetId, setCompletedResetId] = useState<string | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setError(null);
      setUsers(await requestJson<ManagedUser[]>("/api/users"));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger les membres",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function copyPassword(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      window.setTimeout(() => setCopiedValue(null), 2000);
    } catch {
      setError("Impossible de copier automatiquement le mot de passe");
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setNotice(null);

    try {
      const submittedPassword = password;
      const createdUser = await requestJson<ManagedUser>("/api/users", {
        method: "POST",
        body: JSON.stringify({ email, name, role, password }),
      });

      setUsers((currentUsers) =>
        [...currentUsers, createdUser].sort((left, right) =>
          left.name.localeCompare(right.name, "fr"),
        ),
      );
      setEmail("");
      setName("");
      setRole("COMEH_MEMBER");
      setPassword("");
      setCreatedPassword(submittedPassword);
      setNotice(`Le compte de ${createdUser.name} a été créé.`);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de créer le membre",
      );
    } finally {
      setIsPending(false);
    }
  }

  function startEditing(user: ManagedUser) {
    setEditingId(user.id);
    setEditingName(user.name);
    setEditingRole(user.role);
    setResettingId(null);
    setCompletedResetId(null);
    setResetPassword("");
    setError(null);
    setNotice(null);
  }

  async function updateUser(userId: string) {
    setIsPending(true);
    setError(null);
    setNotice(null);

    try {
      const updatedUser = await requestJson<ManagedUser>(`/api/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editingName, role: editingRole }),
      });
      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === updatedUser.id ? updatedUser : user,
        ),
      );
      setEditingId(null);
      setNotice(`Le compte de ${updatedUser.name} a été mis à jour.`);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de modifier le membre",
      );
    } finally {
      setIsPending(false);
    }
  }

  function startPasswordReset(userId: string) {
    setResettingId(userId);
    setResetPassword(generateStrongPassword());
    setCompletedResetId(null);
    setEditingId(null);
    setError(null);
    setNotice(null);
  }

  async function resetUserPassword(user: ManagedUser) {
    setIsPending(true);
    setError(null);
    setNotice(null);

    try {
      await requestJson<ManagedUser>(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: resetPassword }),
      });
      setCompletedResetId(user.id);
      setNotice(
        `Le mot de passe de ${user.name} a été réinitialisé. Notez-le avant de fermer l’encart.`,
      );
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de réinitialiser le mot de passe",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function disableUser(user: ManagedUser) {
    if (
      !window.confirm(
        `Désactiver l’accès de ${user.name} (${user.email}) ? Son compte et son historique restent conservés, mais il ne pourra plus se connecter.`,
      )
    ) {
      return;
    }

    setIsPending(true);
    setError(null);
    setNotice(null);

    try {
      await requestJson(`/api/users/${user.id}`, { method: "DELETE" });
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id
            ? { ...currentUser, disabled: true }
            : currentUser,
        ),
      );
      setNotice(`L’accès de ${user.name} a été désactivé.`);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de désactiver le membre",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function reenableUser(user: ManagedUser) {
    setIsPending(true);
    setError(null);
    setNotice(null);

    try {
      const updatedUser = await requestJson<ManagedUser>(
        `/api/users/${user.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ disabled: false }),
        },
      );
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === updatedUser.id ? updatedUser : currentUser,
        ),
      );
      setNotice(`L’accès de ${user.name} a été réactivé.`);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de réactiver le membre",
      );
    } finally {
      setIsPending(false);
    }
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
            <UserCog className="h-7 w-7" />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Gestion des membres
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
            Créez les comptes de la COMEH, ajustez leurs accès et réinitialisez
            leurs mots de passe.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Plus className="h-5 w-5 text-primary" />
            Créer un membre
          </CardTitle>
          <CardDescription>
            Aucun compte ne peut être créé publiquement : renseignez ici les
            accès du nouveau membre.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={createUser}
          >
            <div className="space-y-2">
              <Label htmlFor="user-email">Adresse e-mail</Label>
              <Input
                autoComplete="off"
                id="user-email"
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="membre@comeh.fr"
                required
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-name">Nom</Label>
              <Input
                autoComplete="off"
                id="user-name"
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder="Prénom Nom"
                required
                value={name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Rôle</Label>
              <Select
                onValueChange={(value) => setRole(value as UserRole)}
                value={role}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((availableRole) => (
                    <SelectItem key={availableRole} value={availableRole}>
                      {roleLabels[availableRole]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Mot de passe</Label>
              <div className="flex gap-2">
                <Input
                  autoComplete="new-password"
                  id="user-password"
                  minLength={12}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="text"
                  value={password}
                />
                <Button
                  aria-label="Copier le mot de passe"
                  disabled={!password}
                  onClick={() => void copyPassword(password)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  {copiedValue === password ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Clipboard className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                className="w-full sm:w-auto"
                onClick={() => setPassword(generateStrongPassword())}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Générer un mot de passe fort
              </Button>
            </div>
            <div className="md:col-span-2">
              <Button
                disabled={isPending || password.length < 12}
                type="submit"
              >
                <Plus className="mr-2 h-4 w-4" />
                Créer le compte
              </Button>
            </div>
          </form>

          {createdPassword ? (
            <div
              aria-live="polite"
              className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"
            >
              <p className="font-semibold">
                Notez ce mot de passe et transmettez-le au membre, il ne sera
                plus affichable ensuite.
              </p>
              <div className="flex max-w-md gap-2">
                <Input
                  aria-label="Mot de passe du compte créé"
                  className="bg-white font-mono"
                  readOnly
                  value={createdPassword}
                />
                <Button
                  aria-label="Copier le mot de passe du compte créé"
                  onClick={() => void copyPassword(createdPassword)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  {copiedValue === createdPassword ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Clipboard className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                onClick={() => setCreatedPassword(null)}
                size="sm"
                type="button"
                variant="ghost"
              >
                J’ai noté le mot de passe
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <p
          aria-live="assertive"
          className="rounded-md border border-accent/20 bg-accent-50 px-4 py-3 text-sm text-accent-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          aria-live="polite"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Membres existants</CardTitle>
          <CardDescription>
            {users.length} compte{users.length > 1 ? "s" : ""} enregistré
            {users.length > 1 ? "s" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Création</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <Fragment key={user.id}>
                <TableRow>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    {editingId === user.id ? (
                      <Input
                        aria-label={`Nom de ${user.name}`}
                        autoFocus
                        maxLength={100}
                        onChange={(event) => setEditingName(event.target.value)}
                        value={editingName}
                      />
                    ) : (
                      user.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === user.id ? (
                      <Select
                        onValueChange={(value) =>
                          setEditingRole(value as UserRole)
                        }
                        value={editingRole}
                      >
                        <SelectTrigger aria-label={`Rôle de ${user.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((availableRole) => (
                            <SelectItem
                              key={availableRole}
                              value={availableRole}
                            >
                              {roleLabels[availableRole]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className={roleClasses[user.role]}>
                          {roleLabels[user.role]}
                        </Badge>
                        {user.disabled ? (
                          <Badge className="border-transparent bg-slate-200 text-slate-600">
                            Désactivé
                          </Badge>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-slate-600">
                    {formatCreatedAt(user.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {editingId === user.id ? (
                        <>
                          <Button
                            aria-label={`Enregistrer les modifications de ${user.name}`}
                            disabled={isPending || !editingName.trim()}
                            onClick={() => void updateUser(user.id)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            aria-label="Annuler les modifications"
                            disabled={isPending}
                            onClick={() => setEditingId(null)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : resettingId === user.id ? null : (
                        <>
                          <Button
                            aria-label={`Modifier ${user.name}`}
                            disabled={isPending}
                            onClick={() => startEditing(user)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            aria-label={`Réinitialiser le mot de passe de ${user.name}`}
                            disabled={isPending}
                            onClick={() => startPasswordReset(user.id)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {user.disabled ? (
                            <Button
                              aria-label={`Réactiver ${user.name}`}
                              disabled={isPending}
                              onClick={() => void reenableUser(user)}
                              size="icon"
                              type="button"
                              variant="ghost"
                            >
                              <UserCheck className="h-4 w-4 text-emerald-600" />
                            </Button>
                          ) : (
                            <Button
                              aria-label={`Désactiver ${user.name}`}
                              disabled={isPending || user.id === currentUserId}
                              onClick={() => void disableUser(user)}
                              size="icon"
                              title={
                                user.id === currentUserId
                                  ? "Vous ne pouvez pas désactiver votre propre compte"
                                  : undefined
                              }
                              type="button"
                              variant="ghost"
                            >
                              <UserX className="h-4 w-4 text-accent" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                  {resettingId === user.id ? (
                    <TableRow>
                    <TableCell className="bg-primary-50" colSpan={5}>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Label htmlFor={`reset-password-${user.id}`}>
                            {completedResetId === user.id
                              ? `Mot de passe réinitialisé pour ${user.name}`
                              : `Nouveau mot de passe pour ${user.name}`}
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              className="font-mono"
                              id={`reset-password-${user.id}`}
                              minLength={12}
                              onChange={(event) =>
                                setResetPassword(event.target.value)
                              }
                              readOnly={completedResetId === user.id}
                              type="text"
                              value={resetPassword}
                            />
                            {completedResetId !== user.id ? (
                              <Button
                                aria-label="Générer un autre mot de passe"
                                onClick={() =>
                                  setResetPassword(generateStrongPassword())
                                }
                                size="icon"
                                type="button"
                                variant="outline"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button
                              aria-label="Copier le nouveau mot de passe"
                              onClick={() => void copyPassword(resetPassword)}
                              size="icon"
                              type="button"
                              variant="outline"
                            >
                              {copiedValue === resetPassword ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Clipboard className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {completedResetId === user.id ? (
                            <Button
                              onClick={() => {
                                setResettingId(null);
                                setCompletedResetId(null);
                                setResetPassword("");
                              }}
                              size="sm"
                              type="button"
                            >
                              J’ai noté le mot de passe
                            </Button>
                          ) : (
                            <>
                              <Button
                                disabled={
                                  isPending || resetPassword.length < 12
                                }
                                onClick={() => void resetUserPassword(user)}
                                size="sm"
                                type="button"
                              >
                                <KeyRound className="mr-2 h-4 w-4" />
                                Réinitialiser
                              </Button>
                              <Button
                                disabled={isPending}
                                onClick={() => {
                                  setResettingId(null);
                                  setResetPassword("");
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                Annuler
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
              {!isLoading && users.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-slate-500"
                    colSpan={5}
                  >
                    Aucun membre enregistré.
                  </TableCell>
                </TableRow>
              ) : null}
              {isLoading ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-slate-500"
                    colSpan={5}
                  >
                    Chargement des membres…
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
