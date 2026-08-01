import { Role } from "@prisma/client";
import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Le nom est requis")
  .max(100, "Le nom est trop long");

const passwordSchema = z
  .string()
  .min(12, "Le mot de passe doit contenir au moins 12 caractères");

export const userCreateSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Adresse e-mail invalide")
    .transform((email) => email.toLowerCase()),
  name: nameSchema,
  role: z.nativeEnum(Role),
  password: passwordSchema,
});

export const userUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    role: z.nativeEnum(Role).optional(),
    password: passwordSchema.optional(),
    disabled: z.boolean().optional(),
  })
  .refine(
    ({ name, role, password, disabled }) =>
      name !== undefined ||
      role !== undefined ||
      password !== undefined ||
      disabled !== undefined,
    { message: "Au moins une modification est requise" },
  );

export const userIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Identifiant requis").max(64),
});
