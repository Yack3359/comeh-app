import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SecurityEventsModule } from "@/components/security/security-events-module";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== Role.ADMIN) {
    redirect("/");
  }

  return <SecurityEventsModule />;
}
