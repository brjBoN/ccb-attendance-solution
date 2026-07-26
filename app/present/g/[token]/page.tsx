import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowUpRight, Clock3, ScanLine } from "lucide-react";
import { TeacherPresentationControls } from "@/components/teacher-presentation-controls";
import { getClassPresentation } from "@/lib/checkin/class-display";

export const metadata: Metadata = {
  title: "Class Check-In Display",
  description: "Teacher presentation view for Heritage Church class check-in.",
  robots: "noindex, nofollow, noarchive",
  referrer: "no-referrer"
};

export default async function ClassPresentationPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const presentation = await getClassPresentation(token);
  if (!presentation) notFound();

  const classImageUrl = `/present/g/${encodeURIComponent(token)}/image`;

  return (
    <main className="relative flex min-h-[100svh] items-center overflow-x-hidden bg-[#0d2d27] px-3 py-4 text-white sm:px-5 md:h-[100svh] md:overflow-hidden md:px-6 md:py-4 lg:px-8 lg:py-5">
      <div
        aria-hidden="true"
        className="absolute -left-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-[#1b7567]/35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-56 -right-32 h-[38rem] w-[38rem] rounded-full bg-[#d89745]/20 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-[1480px] md:flex md:h-full md:flex-col">
        <header className="mb-3 flex shrink-0 items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3">
            <Image
              src="/heritage-church-logo.png"
              alt="Heritage Church"
              width={512}
              height={288}
              priority
              className="h-10 w-auto mix-blend-screen sm:h-11 lg:h-12"
            />
            <span className="hidden h-8 w-px bg-white/15 sm:block" />
            <p className="hidden text-sm font-semibold tracking-wide text-white/60 sm:block">
              Class check-in
            </p>
          </div>
          <TeacherPresentationControls
            backHref={query.from === "teacher" ? "/teacher" : undefined}
          />
        </header>

        <article className="grid overflow-hidden rounded-[30px] border border-white/10 bg-white shadow-[0_36px_100px_rgba(0,0,0,0.28)] sm:rounded-[38px] md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)]">
          <section className="flex min-h-[340px] flex-col overflow-hidden bg-[#163a32] md:min-h-0">
            <div className="relative min-h-[210px] flex-1 overflow-hidden">
              <Image
                src={classImageUrl}
                alt=""
                fill
                unoptimized
                priority
                sizes="(min-width: 768px) 55vw, 100vw"
                className="scale-110 object-cover opacity-45 blur-xl"
              />
              <Image
                src={classImageUrl}
                alt=""
                fill
                unoptimized
                priority
                sizes="(min-width: 768px) 55vw, 100vw"
                className="object-contain"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#0a251f]/35 via-transparent to-black/10"
              />
            </div>

            <div className="shrink-0 bg-[#0a251f] p-5 sm:p-6 md:p-6 lg:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b9eadc] sm:text-sm">
                Heritage Church
              </p>
              <h1 className="mt-2 max-w-4xl break-words text-[clamp(1.8rem,3.3vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
                {presentation.className}
              </h1>
            </div>
          </section>

          <section className="flex flex-col items-center justify-center bg-[#fbfcf9] px-5 py-5 text-center text-[#18332d] sm:px-7 md:min-h-0 md:overflow-y-auto md:px-6 md:py-5 lg:px-8 lg:py-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#e4f1ec] px-3.5 py-2 text-xs font-bold uppercase tracking-[0.13em] text-[#146b5f]">
              <ScanLine className="h-4 w-4" />
              Scan to check in
            </div>

            <div className="mt-3 w-full max-w-[min(82vw,390px)] rounded-[24px] border border-[#dbe4df] bg-white p-2.5 shadow-[0_22px_55px_rgba(23,61,52,0.12)] sm:p-3 md:max-w-[min(38vw,42svh)] lg:max-w-[min(400px,44svh)]">
              <Image
                src={presentation.qrDataUrl}
                alt={`Check-in QR code for ${presentation.className}`}
                width={1200}
                height={1200}
                unoptimized
                priority
                className="h-auto w-full"
              />
            </div>

            <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] sm:text-2xl lg:text-3xl">
              Open your camera and scan
            </h2>
            <p className="mt-1 max-w-md text-sm leading-5 text-[#667670] lg:text-base lg:leading-6">
              Tap the link that appears, find your name, and mark yourself
              present.
            </p>
            <a
              href={presentation.checkinUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#146b5f] underline decoration-[#146b5f]/30 underline-offset-4 transition hover:decoration-[#146b5f]"
            >
              Open check-in link
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>

            {presentation.schedule.length ? (
              <div className="mt-3 flex max-h-24 max-w-md items-start gap-2.5 overflow-y-auto rounded-2xl bg-[#f1f5f1] px-4 py-2.5 text-left text-xs leading-5 text-[#51645e] sm:text-sm">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#167365]" />
                <div>
                  {presentation.schedule.map((slot) => (
                    <p key={slot.id}>
                      <span className="font-semibold text-[#2f4a42]">
                        {slot.dayName} {slot.meetingTime}:
                      </span>{" "}
                      check-in {slot.attendanceWindow} Eastern Time
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </article>
      </div>
    </main>
  );
}
