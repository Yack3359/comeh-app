import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { PilotageModule } from "@/components/pilotage/pilotage-module";
import { authOptions } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";

export default async function PilotagePage() {
  const session = await getServerSession(authOptions);
  const canManage = session ? hasAnyRole(session.user.role, [Role.ADMIN, Role.COMEH_MEMBER]) : false;
  return <PilotageModule canManage={canManage} />;
}
