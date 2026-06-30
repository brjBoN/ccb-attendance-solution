import { AdminCcbChecklist } from "@/components/admin-ccb-checklist";
import { requireFullAdmin } from "@/lib/auth/admin";

export default async function CcbChecklistPage() {
  await requireFullAdmin();
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">CCB Checklist</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Track the CCB web-interface settings that cannot be applied through the public group API.
        </p>
      </div>
      <AdminCcbChecklist />
    </div>
  );
}
