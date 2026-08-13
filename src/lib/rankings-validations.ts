import {
  FencingCategory,
  Gender,
  GripType,
  Handedness,
  PlayStyle,
  Weapon,
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
  pole: optionalText(120),
});

export const athleteUpdateSchema = athleteCreateSchema;

export const athleteQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

export const athleteCategorySchema = z.object({
  seasonId: rankingIdSchema,
  category: z.nativeEnum(FencingCategory),
  rankingPoints: z
    .number()
    .finite()
    .positive("Les points doivent être supérieurs à zéro")
    .multipleOf(0.01, "Deux décimales au maximum")
    .max(99_999_999.99, "Le nombre de points est trop élevé")
    .nullable()
    .optional(),
  selectionCriteria: optionalText(500),
});

export const selectionHelperQuerySchema = z.object({
  seasonId: rankingIdSchema,
  category: z.nativeEnum(FencingCategory),
  weapon: z.nativeEnum(Weapon),
  gender: z.nativeEnum(Gender),
});

export const teamCreateSchema = z.object({
  name: requiredText("Le nom", 120),
  seasonId: rankingIdSchema,
});

export const teamUpdateSchema = teamCreateSchema;

export const teamMemberCreateSchema = z.object({
  athleteId: rankingIdSchema,
  bibNumber: z.coerce
    .number()
    .int()
    .min(1, "Le numéro doit être positif")
    .max(999)
    .nullable()
    .optional(),
});

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
  weapon: z.nativeEnum(Weapon).nullable().optional(),
  gender: z.nativeEnum(Gender).nullable().optional(),
  category: z.nativeEnum(FencingCategory).nullable().optional(),
  isSelective: z.boolean().optional().default(false),
});

export const competitionUpdateSchema = competitionCreateSchema;

const scoreValueSchema = z.coerce
  .number()
  .int()
  .min(0, "Le score doit être positif")
  .max(999, "Score invalide")
  .nullable()
  .optional();

// Classement (rang final, classement initial, classement de poule) : jamais
// de score ni d'adversaire ici, ces informations vivent désormais sur les
// résultats de poule/tableau (type "bout").
const rankingResultSchema = z.object({
  type: z.literal("ranking"),
  competitionId: rankingIdSchema,
  participantType: z.enum(["athlete", "team"]),
  athleteId: rankingIdSchema.nullable().optional(),
  teamId: rankingIdSchema.nullable().optional(),
  rank: z.coerce.number().int().min(1, "Le rang doit être positif").max(10000),
  seedRank: z.coerce
    .number()
    .int()
    .min(1, "Le classement initial doit être positif")
    .max(10000)
    .nullable()
    .optional(),
  poolRank: z.coerce
    .number()
    .int()
    .min(1, "Le classement de poule doit être positif")
    .max(1000)
    .nullable()
    .optional(),
  observations: optionalText(5000),
});

// Résultat unitaire de poule ou de tableau : un adversaire (athlète, ou nom
// d'équipe libre pour les compétitions par équipe face à une nation), un
// score à 2 cases (un par tireur/équipe) et le tour concerné.
const boutResultSchema = z.object({
  type: z.literal("bout"),
  competitionId: rankingIdSchema,
  participantType: z.enum(["athlete", "team"]),
  athleteId: rankingIdSchema.nullable().optional(),
  teamId: rankingIdSchema.nullable().optional(),
  opponentAthleteId: rankingIdSchema.nullable().optional(),
  opponentTeamName: optionalText(160),
  scoreFor: scoreValueSchema,
  scoreAgainst: scoreValueSchema,
  round: optionalText(80),
  won: z.boolean(),
  observations: optionalText(5000),
});

export const resultCreateSchema = z
  .discriminatedUnion("type", [rankingResultSchema, boutResultSchema])
  .superRefine((value, context) => {
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

    if (value.type === "bout") {
      if (value.participantType === "athlete") {
        if (!value.opponentAthleteId) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Adversaire requis",
            path: ["opponentAthleteId"],
          });
        } else if (value.athleteId === value.opponentAthleteId) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "L’athlète et son adversaire doivent être différents",
            path: ["opponentAthleteId"],
          });
        }
      } else if (!value.opponentTeamName) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Équipe adverse requise",
          path: ["opponentTeamName"],
        });
      }
    }
  });

export const resultUpdateSchema = resultCreateSchema;

export const resultQuerySchema = z.object({
  competitionId: rankingIdSchema.optional(),
  athleteId: rankingIdSchema.optional(),
  seasonId: rankingIdSchema.optional(),
  weapon: z.nativeEnum(Weapon).optional(),
  gender: z.nativeEnum(Gender).optional(),
  categoryExclude: z.nativeEnum(FencingCategory).optional(),
});

export const opponentStatsQuerySchema = z.object({
  athleteId: rankingIdSchema,
  seasonId: rankingIdSchema.optional(),
  weapon: z.nativeEnum(Weapon).optional(),
  gender: z.nativeEnum(Gender).optional(),
  categoryExclude: z.nativeEnum(FencingCategory).optional(),
  groupBy: z
    .enum(["country", "handedness", "gripType", "playStyle"])
    .default("country"),
  country: z.string().trim().min(1).max(80).optional(),
  handedness: z.nativeEnum(Handedness).optional(),
  gripType: z.nativeEnum(GripType).optional(),
  playStyle: z.nativeEnum(PlayStyle).optional(),
});

export const athleteHistoryQuerySchema = z.object({
  weapon: z.nativeEnum(Weapon).optional(),
  gender: z.nativeEnum(Gender).optional(),
  categoryExclude: z.nativeEnum(FencingCategory).optional(),
});
