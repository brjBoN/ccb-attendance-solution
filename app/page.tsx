import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  LockKeyhole,
  QrCode,
  ShieldCheck
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-[100svh] overflow-hidden bg-[#F4F8FC] lg:grid lg:grid-cols-[minmax(0,1.18fr)_minmax(420px,0.82fr)]">
      <section className="relative min-h-[57svh] overflow-hidden lg:min-h-[100svh]">
        <Image
          src="/heritage-welcome.jpg"
          alt="Heritage Church volunteers welcoming a child"
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover object-[35%_center] lg:object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,31,63,0.16)_0%,rgba(7,31,63,0.24)_38%,rgba(7,31,63,0.94)_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(0,153,203,0.26),transparent_32rem)]"
        />

        <div className="relative mx-auto flex min-h-[57svh] w-full max-w-5xl flex-col px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:min-h-[100svh] lg:px-12 lg:pb-16 lg:pt-10">
          <Image
            src="/heritage-church-logo.png"
            alt="Heritage Church"
            width={512}
            height={288}
            priority
            className="h-auto w-[190px] drop-shadow-[0_8px_30px_rgba(7,31,63,0.35)] sm:w-[230px] lg:w-[270px]"
          />

          <div className="mt-auto max-w-xl text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#74D9F1] sm:text-sm">
              Heritage Church attendance
            </p>
            <h1 className="mt-3 text-5xl font-semibold leading-none tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Welcome
            </h1>
            <p className="mt-3 text-xl font-medium tracking-[-0.02em] text-white/88 sm:text-2xl">
              What would you like to do?
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-14 flex min-h-0 flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-7 lg:mt-0 lg:min-h-[100svh] lg:justify-center lg:px-10 lg:py-12 xl:px-14">
        <div className="mx-auto w-full max-w-xl space-y-4 lg:max-w-none">
          <ModeCard
            href="/teacher"
            icon={<QrCode className="h-7 w-7" />}
            eyebrow="No login needed"
            title="Find my class"
            body="Choose a class and display its check-in code."
            tone="primary"
          />
          <ModeCard
            href="/login"
            icon={<LockKeyhole className="h-7 w-7" />}
            eyebrow="Admin sign in"
            title="Manage attendance"
            body="Change class times, review guests, and manage classes."
            tone="light"
          />
        </div>

        <footer className="mx-auto mt-7 w-full max-w-xl text-center text-xs text-[#6A7C91] lg:max-w-none">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0866FF]" />
            Attendance synchronized securely with CCB
          </span>
        </footer>
      </section>
    </main>
  );
}

function ModeCard({
  href,
  icon,
  eyebrow,
  title,
  body,
  tone
}: {
  href: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  tone: "primary" | "light";
}) {
  const isPrimary = tone === "primary";

  return (
    <Link
      href={href}
      className={`group flex min-h-[190px] flex-col rounded-[30px] border p-6 transition active:scale-[0.99] sm:p-7 lg:min-h-[210px] lg:hover:-translate-y-1 ${
        isPrimary
          ? "border-[#2879FF] bg-[linear-gradient(135deg,#0866FF_0%,#0754D6_58%,#083365_100%)] text-white shadow-[0_24px_60px_rgba(8,70,156,0.28)]"
          : "border-[#D7E2EE] bg-white text-[#0B1F3A] shadow-[0_24px_60px_rgba(7,31,63,0.12)]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
            isPrimary
              ? "bg-white/14 text-white ring-1 ring-white/20"
              : "bg-[#E6F8FC] text-[#007FA9]"
          }`}
        >
          {icon}
        </span>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition group-hover:translate-x-1 ${
            isPrimary
              ? "bg-white text-[#0866FF]"
              : "bg-[#EAF4FF] text-[#0866FF]"
          }`}
        >
          <ArrowRight className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-auto pt-6">
        <h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          {title}
        </h2>
        <p
          className={`mt-1 text-sm font-semibold ${
            isPrimary ? "text-[#B8EEFA]" : "text-[#0866FF]"
          }`}
        >
          {eyebrow}
        </p>
        <p
          className={`mt-2 text-sm leading-6 ${
            isPrimary ? "text-white/70" : "text-[#5F7187]"
          }`}
        >
          {body}
        </p>
      </div>
    </Link>
  );
}
