import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";

import { BudgetModule } from "@/components/budget/budget-module";
import { authOptions } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";

export default async function BudgetPage() {
  const session = await getServerSession(authOptions);
  const canManage = session
    ? hasAnyRole(session.user.role, [Role.ADMIN, Role.COMEH_MEMBER])
    : false;

  return <BudgetModule canManage={canManage} />;
}

