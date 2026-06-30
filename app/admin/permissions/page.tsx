import { AdminPermissionsManager } from "@/components/admin-permissions-manager";
import { requireFullAdmin } from "@/lib/auth/admin";

export default async function PermissionsPage() {
  await requireFullAdmin();
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Permissions</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          All Supabase Auth users are shown here, including users who do not currently have app access. Link each leader to their CCB individual ID so group-level QR permissions can be enforced.
        </p>
      </div>
      <AdminPermissionsManager />
    </div>
  );
}
