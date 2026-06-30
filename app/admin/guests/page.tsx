import { AdminGuestsManager } from "@/components/admin-guests-manager";
import { requireFullAdmin } from "@/lib/auth/admin";

export default async function AdminGuestsPage() {
  await requireFullAdmin();
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Pending Guests</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Review pending guest/new-person submissions and link or create CCB profiles.</p>
      </div>
      <AdminGuestsManager />
    </div>
  );
}
