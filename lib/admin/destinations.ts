import {
  canCreateGroupsRole,
  isFullAdminRole,
  type AppRole
} from "@/lib/auth/permissions";

export type AdminDestinationKey =
  | "classes"
  | "schedules"
  | "guests"
  | "profile_updates"
  | "checklist"
  | "permissions"
  | "activity"
  | "settings";

export type AdminDestination = {
  key: AdminDestinationKey;
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  access: "all" | "group_creator" | "full_admin";
};

export const ADMIN_DESTINATIONS: AdminDestination[] = [
  {
    key: "schedules",
    href: "/admin/sessions",
    label: "Class schedules",
    shortLabel: "Schedules",
    description: "Change regular meeting times or add a one-time exception.",
    access: "all"
  },
  {
    key: "guests",
    href: "/admin/guests",
    label: "Pending guests",
    shortLabel: "Guests",
    description: "Review new people and connect them with CCB profiles.",
    access: "full_admin"
  },
  {
    key: "profile_updates",
    href: "/admin/profile-updates",
    label: "Profile updates",
    shortLabel: "Profile updates",
    description: "Review phone and email corrections before updating CCB.",
    access: "full_admin"
  },
  {
    key: "classes",
    href: "/admin/groups",
    label: "Classes",
    shortLabel: "Classes",
    description: "Connect CCB groups and choose which classes use check-in.",
    access: "group_creator"
  },
  {
    key: "activity",
    href: "/admin/logs",
    label: "Attendance activity",
    shortLabel: "Activity",
    description: "Review check-ins and retry any failed CCB updates.",
    access: "all"
  },
  {
    key: "checklist",
    href: "/admin/checklist",
    label: "CCB checklist",
    shortLabel: "Checklist",
    description: "Finish the class settings that must be completed in CCB.",
    access: "full_admin"
  },
  {
    key: "permissions",
    href: "/admin/permissions",
    label: "People & permissions",
    shortLabel: "Permissions",
    description: "Connect leader accounts and control their access.",
    access: "full_admin"
  },
  {
    key: "settings",
    href: "/admin/settings",
    label: "System settings",
    shortLabel: "Settings",
    description: "View protected connection details and service checks.",
    access: "full_admin"
  }
];

export function getAdminDestinations(role: AppRole) {
  return ADMIN_DESTINATIONS.filter((destination) => {
    if (destination.access === "full_admin") return isFullAdminRole(role);
    if (destination.access === "group_creator") {
      return canCreateGroupsRole(role);
    }
    return true;
  });
}
