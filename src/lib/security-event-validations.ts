import { SecurityEventType } from "@prisma/client";
import { z } from "zod";

export const securityEventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  type: z.nativeEnum(SecurityEventType).optional(),
});
