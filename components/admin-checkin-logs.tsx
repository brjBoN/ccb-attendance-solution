import { RetryCheckinButton } from "@/components/admin-checkin-logs-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function AdminCheckinLogs() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("attendance_checkins")
    .select(
      `
      id,
      session_id,
      ccb_individual_id,
      source,
      status,
      ccb_sync_status,
      ccb_synced_at,
      error_message,
      created_at,
      metadata,
      checkin_sessions (
        title,
        occurrence_date
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        {error.message}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Session</th>
            <th className="px-4 py-3">CCB person</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Sync</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {data?.length ? (
            data.map((row) => {
              const session = Array.isArray(row.checkin_sessions)
                ? row.checkin_sessions[0]
                : row.checkin_sessions;

              return (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-950">
                      {session?.title ?? "Unknown session"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {session?.occurrence_date ?? row.session_id}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.ccb_individual_id}
                    {row.metadata?.display_name ? (
                      <p className="text-xs text-slate-500">{row.metadata.display_name}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {row.ccb_sync_status}
                    </span>
                    {row.error_message ? (
                      <p className="mt-1 max-w-xs text-xs text-red-700">{row.error_message}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <RetryCheckinButton checkinId={row.id} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No check-ins have been submitted yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
