import Link from "next/link";
import { requireSessionManager } from "@/lib/auth/admin";
import { isFullAdminRole } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireSessionManager(id);
  const supabase = createSupabaseAdminClient();

  const sessionPromise = supabase.from("checkin_sessions").select("*").eq("id", id).maybeSingle();
  const checkinsPromise = supabase.from("attendance_checkins").select("*").eq("session_id", id).order("created_at", { ascending: false });
  const guestsPromise = isFullAdminRole(admin.role)
    ? supabase.from("pending_people").select("*").eq("session_id", id).order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const [{ data: session }, { data: checkins }, { data: guests }] = await Promise.all([
    sessionPromise,
    checkinsPromise,
    guestsPromise
  ]);

  if (!session) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-slate-950">Session not found</h1>
        <Link href="/admin/sessions" className="mt-4 inline-flex text-brand-700 hover:underline">Back to sessions</Link>
      </div>
    );
  }

  const synced = checkins?.filter((row) => row.ccb_sync_status === "synced").length ?? 0;
  const skipped = checkins?.filter((row) => row.ccb_sync_status === "skipped").length ?? 0;
  const failed = checkins?.filter((row) => row.ccb_sync_status === "failed").length ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/sessions" className="text-sm font-semibold text-brand-700 hover:underline">← Back to sessions</Link>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">{session.title}</h1>
        <p className="mt-2 text-slate-600">Group {session.ccb_group_id} • Event {session.ccb_event_id} • {session.occurrence_date}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Metric label="Check-ins" value={String(checkins?.length ?? 0)} />
          <Metric label="Synced" value={String(synced)} />
          <Metric label="Local-only" value={String(skipped)} />
          <Metric label="Failed" value={String(failed)} />
        </div>
      </div>

      <div className={`mt-8 grid gap-6 ${isFullAdminRole(admin.role) ? "lg:grid-cols-2" : ""}`}>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Check-ins</h2>
          <div className="mt-4 space-y-2">
            {checkins?.length ? checkins.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="font-semibold text-slate-950">{row.metadata?.display_name ?? row.ccb_individual_id}</p>
                <p className="text-slate-600">{row.status} • {row.ccb_sync_status} • {new Date(row.created_at).toLocaleString()}</p>
                {row.error_message ? <p className="mt-1 text-xs text-red-700">{row.error_message}</p> : null}
              </div>
            )) : <p className="text-sm text-slate-500">No check-ins yet.</p>}
          </div>
        </section>

        {isFullAdminRole(admin.role) ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Pending guests</h2>
            <div className="mt-4 space-y-2">
              {guests?.length ? guests.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-slate-950">{row.first_name} {row.last_name}</p>
                  <p className="text-slate-600">{row.status} • {row.email || "No email"} • {row.phone || "No phone"}</p>
                </div>
              )) : <p className="text-sm text-slate-500">No guest submissions yet.</p>}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-950">{value}</p></div>;
}
