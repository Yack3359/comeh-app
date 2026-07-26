"use client";

import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function LogoutPanel() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button
        className="flex-1"
        onClick={() => signOut({ callbackUrl: "/login" })}
        type="button"
        variant="destructive"
      >
        Confirmer la déconnexion
      </Button>
      <Button
        className="flex-1"
        onClick={() => window.history.back()}
        type="button"
        variant="outline"
      >
        Annuler
      </Button>
    </div>
  );
}
