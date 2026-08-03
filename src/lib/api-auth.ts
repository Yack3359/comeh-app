import type { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { runWithAuditContext } from "@/lib/audit-context";
import { authOptions } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { extractClientIp, recordSecurityEvent } from "@/lib/security-events";

export async function runAsAuthenticatedUser<T>(
  operation: (userId: string) => Promise<T>,
  allowedRoles?: readonly Role[],
): Promise<T | NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // La session JWT peut être en retard sur la base (rôle changé, compte
  // désactivé) : on revérifie l'état réel de l'utilisateur à chaque appel
  // plutôt que de faire confiance au token, qui ne se rafraîchit qu'à la
  // reconnexion.
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, disabled: true },
  });

  if (!currentUser || currentUser.disabled) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (allowedRoles && !hasAnyRole(currentUser.role, allowedRoles)) {
    const requestHeaders = headers();
    void recordSecurityEvent({
      type: "ACCESS_DENIED",
      userId: session.user.id,
      ipAddress: extractClientIp(requestHeaders),
      userAgent: requestHeaders.get("user-agent"),
      detail: `Rôle ${currentUser.role} insuffisant (requis: ${allowedRoles.join(", ")})`,
    });
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  return runWithAuditContext(session.user.id, () => operation(session.user.id));
}
