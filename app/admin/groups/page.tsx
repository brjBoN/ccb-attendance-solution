import Link from "next/link";
import { AdminGroupsManager } from "@/components/admin-groups-manager";
import { requireAdmin } from "@/lib/auth/admin";
import { canCreateGroupsRole, isFullAdminRole } from "@/lib/auth/permissions";

export default async function AdminGroupsPage() {
  const admin = await requireAdmin();
  const canManageGroups = canCreateGroupsRole(admin.role);
  const canDeleteAppCreatedGroups = isFullAdminRole(admin.role);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Groups</h1>
          {canManageGroups ? (
            <Link href="/admin/groups/new" className="inline-flex w-fit rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Create CCB Group
            </Link>
          ) : null}
        </div>
        <p className="mt-2 max-w-3xl text-slate-600">
          Search CCB groups and manage QR mappings. Group creation/editing requires Group Manager or Admin access.
        </p>
      </div>
      <AdminGroupsManager canManageGroups={canManageGroups} canDeleteAppCreatedGroups={canDeleteAppCreatedGroups} />
    </div>
  );
}
