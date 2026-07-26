import type { Metadata } from "next";

import { LogoutPanel } from "@/components/logout-panel";

export const metadata: Metadata = {
  title: "Déconnexion",
};

export default function LogoutPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-secondary-muted px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-primary/10 bg-secondary p-8 shadow-institutional">
        <div className="mb-6 h-1 w-16 rounded-full bg-accent" />
        <h1 className="text-2xl font-bold text-primary">Se déconnecter ?</h1>
        <p className="mb-7 mt-3 text-sm leading-6 text-slate-600">
          Votre session COMEH sera fermée sur cet appareil.
        </p>
        <LogoutPanel />
      </section>
    </main>
  );
}
