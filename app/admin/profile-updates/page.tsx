import { AdminProfileUpdatesManager } from "@/components/admin-profile-updates-manager";
import { requireFullAdmin } from "@/lib/auth/admin";

export default async function AdminProfileUpdatesPage() {
  await requireFullAdmin();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          Profile updates
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Review phone and email corrections before applying them to CCB.
          These requests are attendee-submitted, so confirm the person before
          approving a change.
        </p>
      </div>
      <AdminProfileUpdatesManager />
    </div>
  );
}
