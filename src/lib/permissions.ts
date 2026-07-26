import { Role } from "@prisma/client";

export const roleLabels: Record<Role, string> = {
  [Role.ADMIN]: "Administrateur",
  [Role.COMEH_MEMBER]: "Membre COMEH",
  [Role.READONLY]: "Lecture seule",
};

const roleWeight: Record<Role, number> = {
  [Role.READONLY]: 1,
  [Role.COMEH_MEMBER]: 2,
  [Role.ADMIN]: 3,
};

export function hasMinimumRole(userRole: Role, minimumRole: Role) {
  return roleWeight[userRole] >= roleWeight[minimumRole];
}

export function hasAnyRole(userRole: Role, allowedRoles: readonly Role[]) {
  return allowedRoles.includes(userRole);
}
