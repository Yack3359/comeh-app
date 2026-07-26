"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type LoginFormProps = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
      callbackUrl,
    });

    setIsPending(false);

    if (!result?.ok) {
      setError("Adresse e-mail ou mot de passe incorrect.");
      return;
    }

    router.push(result.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="email">
          Adresse e-mail
        </label>
        <input
          autoComplete="email"
          className="h-11 w-full rounded-md border border-input bg-secondary px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="password">
          Mot de passe
        </label>
        <input
          autoComplete="current-password"
          className="h-11 w-full rounded-md border border-input bg-secondary px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>

      {error ? (
        <p
          aria-live="polite"
          className="rounded-md border border-accent/20 bg-accent-50 px-3 py-2 text-sm text-accent-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
