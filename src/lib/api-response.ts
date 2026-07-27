import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function invalidDataResponse(error: ZodError) {
  return NextResponse.json(
    {
      error: "Données invalides",
      details: error.flatten().fieldErrors,
    },
    { status: 400 },
  );
}

export function apiErrorResponse(
  error: unknown,
  fallbackMessage = "Une erreur est survenue",
) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Cette valeur existe déjà" },
        { status: 409 },
      );
    }

    if (error.code === "P2025") {
      return NextResponse.json({ error: "Élément introuvable" }, { status: 404 });
    }

    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "Cette opération est impossible car l’élément est utilisé" },
        { status: 409 },
      );
    }
  }

  console.error(error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

