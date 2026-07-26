import type { Metadata } from "next";
import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";
import { AdminGroupsManager } from "@/components/admin-groups-manager";
import { requireGroupCreator } from "@/lib/auth/admin";
import { isFullAdminRole } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Classes"
};

export default async function AdminGroupsPage() {
  const admin = await requireGroupCreator();
  const canManageGroups = true;
  const canDeleteAppCreatedGroups = isFullAdminRole(admin.role);

  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#167365]">
            <UsersRound className="h-4 w-4" />
            CCB groups
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-[#18332d] sm:text-5xl">
            Classes
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#667670]">
            Connect CCB groups to class check-in. Each enabled class receives
            one permanent QR code for all of its meetings.
          </p>
        </div>
        {canManageGroups ? (
          <Link
            href="/admin/groups/new"
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#167365] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(22,115,101,0.18)] transition hover:bg-[#0f6156]"
          >
            <Plus className="h-4 w-4" />
            Create CCB group
          </Link>
        ) : null}
      </div>
      <AdminGroupsManager
        canManageGroups={canManageGroups}
        canDeleteAppCreatedGroups={canDeleteAppCreatedGroups}
      />
    </div>
  );
}
