export const APP_ROLES = ["owner", "admin", "group_manager", "leader"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Admin",
  group_manager: "Group Manager",
  leader: "Group Leader"
};

export function isFullAdminRole(role: AppRole) {
  return role === "owner" || role === "admin";
}

export function canCreateGroupsRole(role: AppRole) {
  return isFullAdminRole(role) || role === "group_manager";
}

export function canManageSessionForGroup(
  user: { role: AppRole; ccbIndividualId: string | null },
  group: { ccb_main_leader_id?: string | null }
) {
  if (isFullAdminRole(user.role)) return true;
  return Boolean(
    user.ccbIndividualId &&
      group.ccb_main_leader_id &&
      user.ccbIndividualId === group.ccb_main_leader_id
  );
}
