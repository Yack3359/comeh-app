import type { Prisma } from "@prisma/client";
import type { z } from "zod";

import type { resultCreateSchema } from "@/lib/rankings-validations";
import { prisma } from "@/lib/prisma";

export type ResultInput = z.infer<typeof resultCreateSchema>;

export function toResultData(
  input: ResultInput,
): Prisma.ResultUncheckedCreateInput {
  if (input.type === "bout") {
    return {
      competitionId: input.competitionId,
      athleteId:
        input.participantType === "athlete" ? (input.athleteId ?? null) : null,
      teamId: input.participantType === "team" ? (input.teamId ?? null) : null,
      opponentAthleteId:
        input.participantType === "athlete"
          ? (input.opponentAthleteId ?? null)
          : null,
      opponentTeamName:
        input.participantType === "team" ? (input.opponentTeamName ?? null) : null,
      rank: null,
      seedRank: null,
      poolRank: null,
      won: input.won,
      scoreFor: input.scoreFor,
      scoreAgainst: input.scoreAgainst,
      round: input.round,
      observations: input.observations,
    };
  }

  return {
    competitionId: input.competitionId,
    athleteId:
      input.participantType === "athlete" ? (input.athleteId ?? null) : null,
    teamId: input.participantType === "team" ? (input.teamId ?? null) : null,
    opponentAthleteId: null,
    opponentTeamName: null,
    rank: input.rank,
    seedRank: input.seedRank,
    poolRank: input.poolRank,
    won: null,
    scoreFor: null,
    scoreAgainst: null,
    round: null,
    observations: input.observations,
  };
}

export async function validateResultRelations(input: ResultInput) {
  const competition = await prisma.competition.findUnique({
    where: { id: input.competitionId },
    select: { id: true, seasonId: true },
  });
  if (!competition) {
    return "invalid_competition" as const;
  }

  if (input.participantType === "athlete") {
    const athleteIds = [input.athleteId, ...(input.type === "bout" ? [input.opponentAthleteId] : [])].filter(
      (id): id is string => Boolean(id),
    );
    const expectedCount = input.type === "bout" ? 2 : 1;
    const athletes = await prisma.athlete.count({
      where: { id: { in: athleteIds } },
    });
    return athletes === expectedCount
      ? ("valid" as const)
      : ("invalid_athletes" as const);
  }

  const team = await prisma.team.findUnique({
    where: { id: input.teamId! },
    select: { seasonId: true },
  });
  if (!team) {
    return "invalid_team" as const;
  }
  return team.seasonId === competition.seasonId
    ? ("valid" as const)
    : ("team_season_mismatch" as const);
}

export function resultRelationError(
  status: Awaited<ReturnType<typeof validateResultRelations>>,
) {
  const messages = {
    invalid_competition: "Compétition invalide",
    invalid_athletes: "Athlète ou adversaire invalide",
    invalid_team: "Équipe invalide",
    team_season_mismatch:
      "L’équipe et la compétition doivent appartenir à la même saison",
  } as const;

  return status === "valid" ? null : messages[status];
}
