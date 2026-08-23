"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileUp,
  Gauge,
  Medal,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";

type AppNavProps = {
  canImport: boolean;
  isAdmin: boolean;
};

const activeClassName =
  "bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground";
const inactiveClassName =
  "px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-50";

export function AppNav({ canImport, isAdmin }: AppNavProps) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Tableau de bord", icon: Gauge },
    { href: "/budget", label: "Frais & budget", icon: WalletCards },
    { href: "/rankings", label: "Rankings", icon: Medal },
    ...(canImport
      ? [{ href: "/imports", label: "Import", icon: FileUp }]
      : []),
    ...(isAdmin
      ? [
          { href: "/users", label: "Membres", icon: Users },
          { href: "/audit", label: "Journal d’audit", icon: ScrollText },
          { href: "/security", label: "Sécurité", icon: ShieldAlert },
        ]
      : []),
  ];

  return (
    <nav aria-label="Navigation principale" className="space-y-1">
      {links.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            className={`flex items-center gap-3 rounded-lg ${
              isActive ? activeClassName : inactiveClassName
            }`}
            href={href}
            key={href}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
      <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500">
        <ShieldCheck className="h-4 w-4" />
        Socle sécurisé
      </div>
    </nav>
  );
}
