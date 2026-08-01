import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { UserManager } from "@/components/users/user-manager";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== Role.ADMIN) {
    redirect("/");
  }

  return <UserManager currentUserId={session.user.id} />;
}
