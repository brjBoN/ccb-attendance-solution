import { AdminCheckinLogs } from "@/components/admin-checkin-logs";

export default function AdminLogsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Logs</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Recent check-in attempts and CCB sync state. Retry failed records after correcting service permissions or event data.
        </p>
      </div>
      <AdminCheckinLogs />
    </div>
  );
}
