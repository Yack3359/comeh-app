import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";

import { Dashboard } from "@/components/dashboard/dashboard";
import { authOptions } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const canImport = session
    ? hasAnyRole(session.user.role, [Role.ADMIN, Role.COMEH_MEMBER])
    : false;

  return <Dashboard canImport={canImport} />;
}
