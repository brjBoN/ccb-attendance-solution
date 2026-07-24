import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Radio,
  ScanLine,
  ShieldCheck
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f3f2ec]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="rounded-2xl bg-[#12362f] px-3 py-1.5"
        >
          <Image
            src="/heritage-church-logo.png"
            alt="Heritage Church"
            width={512}
            height={288}
            priority
            className="h-auto w-[150px] mix-blend-screen"
          />
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-[#cdd5d0] bg-white px-4 py-2.5 text-sm font-semibold text-[#29473f] transition hover:border-[#aebfb6]"
        >
          Leader sign in
        </Link>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cde2db] bg-[#e6f3ee] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#14685b]">
            <Radio className="h-3.5 w-3.5" />
            Heritage Church attendance
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-[#15362e] sm:text-6xl lg:text-7xl">
            Class attendance that follows the schedule.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#667670]">
            Leaders set each class&apos;s weekly times, members check in when
            class meets, and attendance is synchronized to CCB.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin/sessions"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#167365] px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(22,115,101,0.22)] transition hover:bg-[#0f6156]"
            >
              Manage schedules
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-[#cdd5d0] bg-white px-5 py-3.5 text-sm font-semibold text-[#29473f] transition hover:border-[#aebfb6]"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#5d7069]">
            <Benefit>Automatic class schedules</Benefit>
            <Benefit>Private profile search</Benefit>
            <Benefit>CCB attendance sync</Benefit>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -left-5 top-12 hidden w-40 rounded-2xl border border-[#d9ddd7] bg-white p-4 shadow-[0_18px_45px_rgba(24,45,39,0.12)] sm:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#84908c]">
              Status
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#20584c]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#30a288]" />
              Open now
            </div>
          </div>

          <div className="overflow-hidden rounded-[34px] bg-[#12362f] p-5 shadow-[0_34px_100px_rgba(18,54,47,0.24)] sm:p-7">
            <div className="flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a8decf]">
                  Tuesday Small Group
                </p>
                <h2 className="mt-1 text-xl font-semibold">Permanent class QR</h2>
              </div>
              <ScanLine className="h-6 w-6 text-[#f1b86b]" />
            </div>

            <div className="mt-6 grid gap-5 rounded-[24px] bg-white p-5 sm:grid-cols-[1fr_0.78fr]">
              <div className="aspect-square rounded-2xl bg-[#f6f7f3] p-5">
                <div
                  aria-label="Decorative QR code preview"
                  className="grid h-full grid-cols-7 gap-1"
                >
                  {Array.from({ length: 49 }).map((_, index) => {
                    const filled = [
                      0, 1, 2, 4, 5, 6, 7, 9, 11, 13, 14, 15, 16, 18, 19,
                      20, 23, 25, 28, 29, 30, 32, 34, 35, 37, 39, 41, 42, 43,
                      44, 46, 48
                    ].includes(index);
                    return (
                      <span
                        key={index}
                        className={`rounded-[2px] ${
                          filled ? "bg-[#12362f]" : "bg-transparent"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#167365]">
                  Print once
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#203b34]">
                  Use at every meeting
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#6d7b76]">
                  The link automatically follows whichever class meeting is
                  open.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <MiniStep number="1" label="Open" />
              <MiniStep number="2" label="Scan" />
              <MiniStep number="3" label="Present" />
            </div>
          </div>

          <div className="absolute -bottom-6 -right-3 hidden w-48 rounded-2xl border border-[#d9ddd7] bg-[#fff8e8] p-4 shadow-[0_18px_45px_rgba(24,45,39,0.12)] sm:block">
            <ShieldCheck className="h-5 w-5 text-[#9b6a22]" />
            <p className="mt-2 text-sm font-semibold text-[#5e4927]">
              Synced securely to CCB
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Benefit({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4 text-[#167365]" />
      {children}
    </span>
  );
}

function MiniStep({ number, label }: { number: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/[0.07] px-2 py-3 text-white/72">
      <span className="block text-[10px] font-bold text-[#f1b86b]">{number}</span>
      <span className="mt-1 block text-xs font-semibold">{label}</span>
    </div>
  );
}
