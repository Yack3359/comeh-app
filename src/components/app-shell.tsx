import type { Session } from "next-auth";
import Link from "next/link";
import {
  FileUp,
  Gauge,
  LogOut,
  Medal,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { Role } from "@prisma/client";

import { hasAnyRole, roleLabels } from "@/lib/permissions";

type AppShellProps = {
  children: React.ReactNode;
  session: Session;
};

export function AppShell({ children, session }: AppShellProps) {
  const canImport = hasAnyRole(session.user.role, [
    Role.ADMIN,
    Role.COMEH_MEMBER,
  ]);

  return (
    <div className="min-h-screen bg-secondary-muted">
      <header className="border-b border-primary/10 bg-secondary shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-3" href="/">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-black tracking-tight text-primary-foreground">
              EH
            </span>
            <span>
              <span className="block text-sm font-bold uppercase tracking-[0.18em] text-primary">
                COMEH
              </span>
              <span className="hidden text-xs text-slate-500 sm:block">
                COMmission Épée Homme
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">
                {session.user.name}
              </p>
              <p className="text-xs text-slate-500">
                {roleLabels[session.user.role]}
              </p>
            </div>
            <Link
              aria-label="Se déconnecter"
              className="rounded-md p-2 text-primary transition hover:bg-primary-50"
              href="/logout"
            >
              <LogOut className="h-5 w-5" />
            </Link>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-primary via-secondary to-accent" />
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
        <aside className="h-fit rounded-xl border border-primary/10 bg-secondary p-3 shadow-institutional">
          <nav aria-label="Navigation principale" className="space-y-1">
            <Link
              className="flex items-center gap-3 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
              href="/"
            >
              <Gauge className="h-4 w-4" />
              Tableau de bord
            </Link>
            <Link
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-50"
              href="/budget"
            >
              <WalletCards className="h-4 w-4" />
              Frais & budget
            </Link>
            <Link
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-50"
              href="/rankings"
            >
              <Medal className="h-4 w-4" />
              Rankings
            </Link>
            {canImport ? (
              <Link
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-50"
                href="/imports"
              >
                <FileUp className="h-4 w-4" />
                Import
              </Link>
            ) : null}
            {session.user.role === Role.ADMIN ? (
              <>
                <Link
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-50"
                  href="/users"
                >
                  <Users className="h-4 w-4" />
                  Membres
                </Link>
                <Link
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-50"
                  href="/audit"
                >
                  <ScrollText className="h-4 w-4" />
                  Journal d’audit
                </Link>
                <Link
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-50"
                  href="/security"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Sécurité
                </Link>
              </>
            ) : null}
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              Socle sécurisé
            </div>
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}
