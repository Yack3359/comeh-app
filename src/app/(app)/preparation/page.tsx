import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { PreparationModule } from "@/components/preparation/preparation-module";
import { authOptions } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";

export default async function PreparationPage() {
  const session = await getServerSession(authOptions);
  const canPrepare = session ? hasAnyRole(session.user.role, [Role.ADMIN, Role.COMEH_MEMBER, Role.CONTRIBUTOR]) : false;
  const canDecide = session ? hasAnyRole(session.user.role, [Role.ADMIN, Role.COMEH_MEMBER]) : false;
  return <PreparationModule canPrepare={canPrepare} canDecide={canDecide} isAdmin={session?.user.role === Role.ADMIN} />;
}
