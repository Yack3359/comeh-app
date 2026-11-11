"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileUp,
  Gauge,
  Target,
  ShieldCheck,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

type AppNavProps = {
  canImport: boolean;
  isAdmin: boolean;
};

type NavEntry = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: Array<{ href: string; label: string; view?: string }>;
};

const activeClassName =
  "bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground";
const inactiveClassName =
  "px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-50";

export function AppNav(props: AppNavProps) {
  return <Suspense fallback={null}><AppNavContent {...props} /></Suspense>;
}

function AppNavContent({ canImport, isAdmin }: AppNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const currentModule = ["/users", "/audit", "/security"].some(
    href => pathname === href || pathname.startsWith(href + "/"),
  ) ? "/users" : "/" + pathname.split("/")[1];

  useEffect(() => {
    setExpanded(current => ({ ...current, [currentModule]: true }));
  }, [currentModule]);

  const links: NavEntry[] = [
    { href: "/", label: "Accueil", icon: Gauge },
    { href: "/pilotage", label: "Suivi du budget", icon: Target, children: [
      { href: "/pilotage?vue=synthese", label: "Où en est-on ?", view: "synthese" },
      { href: "/pilotage?vue=actions", label: "Détail des actions", view: "actions" },
      { href: "/pilotage?vue=analyses", label: "Analyses par période", view: "analyses" },
      { href: "/pilotage?vue=recettes", label: "Recettes clubs", view: "recettes" },
      { href: "/pilotage?vue=construction", label: "Construction du budget", view: "construction" },
      ...(canImport ? [{ href: "/pilotage?vue=import", label: "Importer la matrice FFE", view: "import" }] : []),
      { href: "/pilotage?vue=historique", label: "Historique des imports", view: "historique" },
    ] },
    { href: "/preparation", label: "Préparer le budget", icon: Target, children: [
      { href: "/preparation?vue=avancement", label: "Avancement", view: "avancement" },
      { href: "/preparation?vue=lignes", label: "Compétitions et stages", view: "lignes" },
      { href: "/preparation?vue=construction", label: "Construction du budget", view: "construction" },
    ] },
    { href: "/budget", label: "Notes de frais", icon: WalletCards, children: [
      { href: "/budget?vue=suivi", label: "Suivi des frais par saison", view: "suivi" },
      { href: "/budget?vue=notes", label: "Notes de frais", view: "notes" },
      { href: "/budget?vue=export-ffe", label: "Export FFE", view: "export-ffe" },
      ...(canImport ? [{ href: "/budget?vue=import", label: "Importer des justificatifs", view: "import" }] : []),
      { href: "/budget?vue=previsionnel", label: "Prévisionnel par saison", view: "previsionnel" },
      { href: "/budget?vue=categories", label: "Catégories", view: "categories" },
    ] },
    ...(canImport ? [{ href: "/imports", label: "Import", icon: FileUp }] : []),
    ...(isAdmin ? [{ href: "/users", label: "Administration", icon: Users, children: [
      { href: "/users", label: "Membres" },
      { href: "/audit", label: "Journal d’audit" },
      { href: "/security", label: "Sécurité" },
    ] }] : []),
  ];

  return (
    <nav aria-label="Navigation principale" className="space-y-1">
      {links.map(({ href, label, icon: Icon, children }) => {
        const isActive = href === "/" ? pathname === "/" : currentModule === href;
        const isExpanded = expanded[href] ?? isActive;
        const controls = "nav-" + href.slice(1);
        const requestedView = searchParams.get("vue");
        const activeView = children?.some(child => child.view === requestedView)
          ? requestedView : children?.[0].view;

        return (
          <div key={href}>
            <div className="flex items-center gap-1">
              <Link
                className={"flex min-w-0 flex-1 items-center gap-3 rounded-lg " + (isActive ? activeClassName : inactiveClassName)}
                href={href}
                aria-current={isActive && !children ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
              {children && <button
                type="button"
                className="rounded-lg p-2 text-primary hover:bg-primary-50"
                aria-label={(isExpanded ? "Replier " : "Déplier ") + label}
                aria-expanded={isExpanded}
                aria-controls={controls}
                onClick={() => setExpanded(current => ({ ...current, [href]: !isExpanded }))}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>}
            </div>
            {children && <ul id={controls} hidden={!isExpanded} className="mt-1 space-y-1 border-l pl-9">
              {children.map(child => {
                const active = child.view ? isActive && activeView === child.view : pathname === child.href;
                return <li key={child.href}><Link
                  href={child.href}
                  aria-current={active ? "page" : undefined}
                  className={"block rounded-lg px-3 py-2 text-xs " + (active
                    ? "bg-primary-50 text-primary font-semibold"
                    : "text-slate-600 hover:bg-primary-50")}
                >{child.label}</Link></li>;
              })}
            </ul>}
          </div>
        );
      })}
      <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500">
        <ShieldCheck className="h-4 w-4" />
        Socle sécurisé
      </div>
    </nav>
  );
}
