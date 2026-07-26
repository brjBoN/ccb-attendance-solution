import type { Metadata } from "next";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Radio,
  ScanLine,
  ShieldCheck
} from "lucide-react";
import { getPublicCheckinSessionByToken } from "@/lib/checkin/public-session";
import { PublicCheckinForm } from "@/components/public-checkin-form";

export const metadata: Metadata = {
  title: "Check In"
};

export default async function PublicCheckInPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPublicCheckinSessionByToken(token);

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-[#f4f8fc] px-4 py-8 sm:py-14">
        <div className="mx-auto max-w-lg overflow-hidden rounded-[30px] border border-[#d7e2ee] bg-white shadow-[0_28px_80px_rgba(7,31,63,0.12)]">
          <div className="bg-[#071f3f] px-6 py-7 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#74d9f1]">
              <ScanLine className="h-4 w-4" />
              Class check-in
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.035em]">
              {result.groupName ?? "Check-in is not open"}
            </h1>
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e6f8fc] text-[#007fa9]">
              <Clock3 className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[#132b48]">
              Nothing to do just yet
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5f7187]">
              {result.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const { session } = result;
  const meetingDate = new Date(
    session.occurrenceStartAt ??
      `${session.occurrenceDate}T12:00:00`
  );
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(meetingDate);
  const timeLabel = session.occurrenceStartAt
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit"
      }).format(meetingDate)
    : null;

  return (
    <main className="min-h-screen bg-[#f4f8fc] px-3 py-4 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-[30px] border border-[#d7e2ee] bg-white shadow-[0_28px_80px_rgba(7,31,63,0.12)]">
        <header className="relative overflow-hidden bg-[#071f3f] px-5 py-7 text-white sm:px-8 sm:py-9">
          <div
            aria-hidden="true"
            className="absolute -right-8 -top-8 h-36 w-36 rounded-full border-[26px] border-white/[0.05]"
          />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#74d9f1]">
                <ScanLine className="h-4 w-4" />
                Class check-in
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f8fc] px-3 py-1.5 text-xs font-bold text-[#007fa9]">
                <Radio className="h-3 w-3" />
                Open now
              </span>
            </div>

            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
              {session.groupName ?? "CCB class"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              {session.title}
            </h1>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-sm text-white/80">
                <CalendarDays className="h-4 w-4 text-[#0099cb]" />
                {dateLabel}
              </span>
              {timeLabel ? (
                <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-sm text-white/80">
                  <Clock3 className="h-4 w-4 text-[#0099cb]" />
                  {timeLabel}
                </span>
              ) : null}
            </div>
          </div>
        </header>

        <section className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex items-start gap-3 rounded-2xl bg-[#eef6ff] p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#0866ff] shadow-sm">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-[#17304d]">Mark yourself present</h2>
              <p className="mt-1 text-sm leading-6 text-[#64778a]">
                Find your CCB profile, select your name, and you&apos;re done.
              </p>
            </div>
          </div>

          <PublicCheckinForm token={token} />

          <div className="mt-7 flex items-center justify-center gap-2 border-t border-[#e2ebf4] pt-5 text-xs text-[#7a8b9d]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Your contact details are masked in search results.
          </div>
        </section>
      </div>
    </main>
  );
}
