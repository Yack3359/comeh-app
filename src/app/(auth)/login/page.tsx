import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Connexion",
};

type LoginPageProps = {
  searchParams?: {
    callbackUrl?: string;
  };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/");
  }

  const requestedCallback = searchParams?.callbackUrl;
  const callbackUrl =
    requestedCallback?.startsWith("/") && !requestedCallback.startsWith("//")
      ? requestedCallback
      : "/";

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-primary px-4 py-12">
      <div
        aria-hidden
        className="absolute -left-28 top-1/4 h-80 w-80 rounded-full border-[42px] border-white/5"
      />
      <div
        aria-hidden
        className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
      />

      <section className="relative w-full max-w-md overflow-hidden rounded-2xl bg-secondary shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-accent" />
        <div className="p-7 sm:p-9">
          <div className="mb-8">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
              EH
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
              Espace sécurisé
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-primary">
              Connexion COMEH
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Accédez à l’outil de la COMmission Épée Homme.
            </p>
          </div>

          <LoginForm callbackUrl={callbackUrl} />
        </div>
      </section>
    </main>
  );
}
