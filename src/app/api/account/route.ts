import { NextResponse } from "next/server";
import { z } from "zod";

import { runAsAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const updateAccountSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

export async function PATCH(request: Request) {
  const requestBody = await request.json().catch(() => null);
  const parsedBody = updateAccountSchema.safeParse(requestBody);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Données invalides",
        details: parsedBody.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const result = await runAsAuthenticatedUser((userId) =>
    prisma.user.update({
      where: { id: userId },
      data: { name: parsedBody.data.name },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    }),
  );

  if (result instanceof NextResponse) {
    return result;
  }

  return NextResponse.json(result);
}
