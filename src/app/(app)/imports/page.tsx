import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { ImportsModule } from "@/components/imports/imports-module";
import { authOptions } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    !hasAnyRole(session.user.role, [Role.ADMIN, Role.COMEH_MEMBER])
  ) {
    redirect("/");
  }

  return <ImportsModule />;
}

