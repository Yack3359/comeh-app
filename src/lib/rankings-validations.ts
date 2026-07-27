import {
  Gender,
  GripType,
  Handedness,
  PlayStyle,
} from "@prisma/client";
import { z } from "zod";

export const rankingIdSchema = z.string().trim().min(1, "Identifiant requis").max(64);

const requiredText = (label: string, maximum = 120) =>
  z
    .string()
    .trim()
    .min(2, `${label} est trop court`)
    .max(maximum, `${label} est trop long`);

const optionalText = (maximum = 160) =>
  z
    .union([
      z.string().trim().max(maximum, "Valeur trop longue"),
      z.null(),
    ])
    .optional()
    .transform((value) => {
      const normalized = value ?? "";
      return normalized.length > 0 ? normalized : null;
    });

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Date invalide");

export const entityParamsSchema = z.object({ id: rankingIdSchema });

export const athleteCreateSchema = z.object({
  firstName: requiredText("Le prénom", 80),
  lastName: requiredText("Le nom", 80),
  gender: z.nativeEnum(Gender),
  country: requiredText("Le pays", 80),
  handedness: z.nativeEnum(Handedness).nullable().optional(),
  gripType: z.nativeEnum(GripType).nullable().optional(),
  playStyle: z.nativeEnum(PlayStyle).nullable().optional(),
  club: optionalText(120),
});

export const athleteUpdateSchema = athleteCreateSchema;

export const athleteQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

export const athleteCategorySchema = z.object({
  seasonId: rankingIdSchema,
  category: requiredText("La catégorie", 80),
});

export const teamCreateSchema = z.object({
  name: requiredText("Le nom", 120),
  seasonId: rankingIdSchema,
});

export const teamUpdateSchema = teamCreateSchema;

export const seasonFilterSchema = z.object({
  seasonId: rankingIdSchema.optional(),
});

export const competitionCreateSchema = z.object({
  name: requiredText("Le nom", 160),
  location: requiredText("Le lieu", 120),
  country: requiredText("Le pays", 80),
  date: dateSchema,
  level: requiredText("Le niveau", 80),
  seasonId: rankingIdSchema,
});

export const competitionUpdateSchema = competitionCreateSchema;

const rankingResultSchema = z.object({
  type: z.literal("ranking"),
  competitionId: rankingIdSchema,
  participantType: z.enum(["athlete", "team"]),
  athleteId: rankingIdSchema.nullable().optional(),
  teamId: rankingIdSchema.nullable().optional(),
  rank: z.coerce.number().int().min(1, "Le rang doit être positif").max(10000),
  score: optionalText(80),
  round: optionalText(80),
});

const boutResultSchema = z.object({
  type: z.literal("bout"),
  competitionId: rankingIdSchema,
  athleteId: rankingIdSchema,
  opponentAthleteId: rankingIdSchema,
  won: z.boolean(),
  score: optionalText(80),
  round: optionalText(80),
});

export const resultCreateSchema = z
  .discriminatedUnion("type", [rankingResultSchema, boutResultSchema])
  .superRefine((value, context) => {
    if (value.type === "ranking") {
      if (value.participantType === "athlete" && !value.athleteId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Athlète requis",
          path: ["athleteId"],
        });
      }
      if (value.participantType === "team" && !value.teamId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Équipe requise",
          path: ["teamId"],
        });
      }
    } else if (value.athleteId === value.opponentAthleteId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "L’athlète et son adversaire doivent être différents",
        path: ["opponentAthleteId"],
      });
    }
  });

export const resultUpdateSchema = resultCreateSchema;

export const resultQuerySchema = z.object({
  competitionId: rankingIdSchema.optional(),
  athleteId: rankingIdSchema.optional(),
  seasonId: rankingIdSchema.optional(),
});

export const opponentStatsQuerySchema = z.object({
  athleteId: rankingIdSchema,
  seasonId: rankingIdSchema.optional(),
  groupBy: z
    .enum(["country", "handedness", "gripType", "playStyle"])
    .default("country"),
  country: z.string().trim().min(1).max(80).optional(),
  handedness: z.nativeEnum(Handedness).optional(),
  gripType: z.nativeEnum(GripType).optional(),
  playStyle: z.nativeEnum(PlayStyle).optional(),
});
