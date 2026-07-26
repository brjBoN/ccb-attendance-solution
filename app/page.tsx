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
    <main className="relative min-h-[100svh] overflow-hidden bg-[#f3f2ec]">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[410px] bg-[#12362f] sm:h-[360px]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-32 top-10 h-80 w-80 rounded-full border-[52px] border-white/[0.035]"
      />
      <div
        aria-hidden="true"
        className="absolute -left-32 top-44 h-72 w-72 rounded-full bg-[#1c7163]/20 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col px-4 pb-8 pt-4 sm:px-7 sm:pt-6">
        <header className="flex min-h-14 items-center">
          <Image
            src="/heritage-church-logo.png"
            alt="Heritage Church"
            width={512}
            height={288}
            priority
            className="h-auto w-[180px] mix-blend-screen sm:w-[220px]"
          />
        </header>

        <section className="mt-10 sm:mt-14">
          <div className="max-w-2xl text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#a8decf]">
              Heritage Church attendance
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">
              What would you like to do?
            </h1>
            <p className="mt-3 text-base leading-7 text-white/65">
              Teachers can open a class QR code right away. Administration
              requires a sign-in.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <ModeCard
              href="/teacher"
              icon={<QrCode className="h-7 w-7" />}
              eyebrow="No login needed"
              title="Find my class"
              body="Choose a class and show its QR code for everyone to scan."
              tone="accent"
            />
            <ModeCard
              href="/login"
              icon={<LockKeyhole className="h-7 w-7" />}
              eyebrow="Admin access"
              title="Manage attendance"
              body="Change class times, review guests, manage classes, and check activity."
              tone="light"
            />
          </div>
        </section>

        <footer className="mt-auto pt-8 text-center text-xs text-[#6f7e79]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Attendance synchronized securely with CCB
          </span>
        </footer>
      </div>
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
  tone: "accent" | "light";
}) {
  const styles =
    tone === "accent"
      ? "border-[#e7bc7f] bg-[#f1b86b] text-[#2e342b] shadow-[0_22px_55px_rgba(71,55,31,0.22)]"
      : "border-[#d9ddd7] bg-white text-[#18332d] shadow-[0_22px_55px_rgba(24,45,39,0.12)]";
  const iconStyles =
    tone === "accent"
      ? "bg-white/55 text-[#4f4a32]"
      : "bg-[#e3f1ec] text-[#146b5f]";
  const eyebrowStyles =
    tone === "accent" ? "text-[#6c5429]" : "text-[#167365]";
  const bodyStyles =
    tone === "accent" ? "text-[#655837]" : "text-[#667670]";

  return (
    <Link
      href={href}
      className={`group flex min-h-[245px] flex-col rounded-[30px] border p-6 transition active:scale-[0.99] sm:p-7 sm:hover:-translate-y-1 ${styles}`}
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconStyles}`}
      >
        {icon}
      </span>
      <p
        className={`mt-7 text-xs font-bold uppercase tracking-[0.14em] ${eyebrowStyles}`}
      >
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
        {title}
      </h2>
      <div className="mt-3 flex items-end justify-between gap-5">
        <p className={`max-w-md text-sm leading-6 ${bodyStyles}`}>{body}</p>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#12362f] text-white transition group-hover:translate-x-1">
          <ArrowRight className="h-5 w-5" />
        </span>
      </div>
    </Link>
  );
}
