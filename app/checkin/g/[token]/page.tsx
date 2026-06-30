import { CalendarClock, ShieldAlert } from "lucide-react";
import { getPublicCheckinSessionByToken } from "@/lib/checkin/public-session";
import { PublicCheckinForm } from "@/components/public-checkin-form";

export default async function PublicCheckInPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPublicCheckinSessionByToken(token);

  if (!result.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Check-in unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{result.message}</p>
        </div>
      </main>
    );
  }

  const { session } = result;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 rounded-xl bg-brand-50 p-4 text-brand-900">
          <p className="text-sm font-medium">Small group check-in</p>
          <p className="mt-1 text-xs text-brand-700">
            Search for your CCB profile, select yourself, and confirm attendance.
          </p>
        </div>

        <h1 className="text-2xl font-bold text-slate-950">{session.title}</h1>
        {session.groupName ? (
          <p className="mt-1 font-medium text-slate-700">{session.groupName}</p>
        ) : null}

        <div className="mt-5 rounded-xl border border-slate-200 p-4">
          <div className="flex gap-3">
            <CalendarClock className="mt-0.5 h-5 w-5 text-slate-500" />
            <div>
              <p className="font-medium text-slate-950">Meeting occurrence</p>
              <p className="mt-1 text-sm text-slate-600">{session.occurrenceDate}</p>
              {session.occurrenceStartAt ? (
                <p className="mt-1 text-sm text-slate-600">
                  Starts: {new Date(session.occurrenceStartAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <PublicCheckinForm token={token} />
      </div>
    </main>
  );
}
