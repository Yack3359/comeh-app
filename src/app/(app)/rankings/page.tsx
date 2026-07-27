import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";

import { RankingsModule } from "@/components/rankings/rankings-module";
import { authOptions } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";

export default async function RankingsPage() {
  const session = await getServerSession(authOptions);
  const canManage = session
    ? hasAnyRole(session.user.role, [Role.ADMIN, Role.COMEH_MEMBER])
    : false;

  return <RankingsModule canManage={canManage} />;
}
