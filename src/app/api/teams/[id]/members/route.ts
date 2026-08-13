import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { apiErrorResponse, invalidDataResponse } from "@/lib/api-response";
import {
  entityParamsSchema,
  teamMemberCreateSchema,
} from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

const writeRoles = [Role.ADMIN, Role.COMEH_MEMBER] as const;

type RouteContext = {
  params: { id: string };
};

export async function POST(request: Request, context: RouteContext) {
  const parsedParams = entityParamsSchema.safeParse(context.params);
  const parsedBody = teamMemberCreateSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedParams.success) {
    return invalidDataResponse(parsedParams.error);
  }
  if (!parsedBody.success) {
    return invalidDataResponse(parsedBody.error);
  }

  try {
    const result = await runAsAuthenticatedUser(
      async () => {
        const [team, athlete] = await Promise.all([
          prisma.team.findUnique({
            where: { id: parsedParams.data.id },
            select: { id: true },
          }),
          prisma.athlete.findUnique({
            where: { id: parsedBody.data.athleteId },
            select: { id: true },
          }),
        ]);

        if (!team || !athlete) {
          return { status: "invalid_relation" as const };
        }

        const existing = await prisma.teamMember.findUnique({
          where: {
            teamId_athleteId: {
              teamId: team.id,
              athleteId: athlete.id,
            },
          },
          select: { id: true },
        });
        if (existing) {
          return { status: "already_member" as const };
        }

        if (parsedBody.data.bibNumber != null) {
          const bibTaken = await prisma.teamMember.findUnique({
            where: {
              teamId_bibNumber: {
                teamId: team.id,
                bibNumber: parsedBody.data.bibNumber,
              },
            },
            select: { id: true },
          });
          if (bibTaken) {
            return { status: "bib_taken" as const };
          }
        }

        const member = await prisma.teamMember.create({
          data: {
            teamId: team.id,
            athleteId: athlete.id,
            bibNumber: parsedBody.data.bibNumber ?? null,
          },
          select: { id: true },
        });
        return { status: "created" as const, member };
      },
      writeRoles,
    );

    if (result instanceof NextResponse) {
      return result;
    }
    if (result.status === "invalid_relation") {
      return NextResponse.json(
        { error: "Équipe ou athlète introuvable" },
        { status: 400 },
      );
    }
    if (result.status === "already_member") {
      return NextResponse.json(
        { error: "Cet athlète fait déjà partie de l’équipe" },
        { status: 409 },
      );
    }
    if (result.status === "bib_taken") {
      return NextResponse.json(
        { error: "Ce numéro est déjà attribué dans cette équipe" },
        { status: 409 },
      );
    }

    return NextResponse.json(result.member, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Impossible d’ajouter ce tireur à l’équipe");
  }
}
