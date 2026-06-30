import { AdminSessionsManager } from "@/components/admin-sessions-manager";

export default function AdminSessionsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          QR Sessions
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Create secure QR check-in sessions for mapped groups. Phase 3 only creates
          local sessions and tokens; attendance submission comes later.
        </p>
      </div>

      <AdminSessionsManager />
    </div>
  );
}
