import type { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { runWithAuditContext } from "@/lib/audit-context";
import { authOptions } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";

export async function runAsAuthenticatedUser<T>(
  operation: (userId: string) => Promise<T>,
  allowedRoles?: readonly Role[],
): Promise<T | NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (allowedRoles && !hasAnyRole(session.user.role, allowedRoles)) {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  return runWithAuditContext(session.user.id, () => operation(session.user.id));
}
