import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { TeacherClassList } from "@/components/teacher-class-list";
import { listPublicTeacherClasses } from "@/lib/teacher/classes";

export const metadata: Metadata = {
  title: "Choose Your Class"
};

export const dynamic = "force-dynamic";

export default async function TeacherClassesPage() {
  const classes = await listPublicTeacherClasses();

  return (
    <main className="min-h-[100svh] bg-[#f3f2ec]">
      <header className="border-b border-white/10 bg-[#12362f] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-7 sm:py-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-semibold text-white/80 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Start
          </Link>
          <Image
            src="/heritage-church-logo.png"
            alt="Heritage Church"
            width={512}
            height={288}
            priority
            className="h-auto w-[150px] mix-blend-screen sm:w-[185px]"
          />
          <Link
            href="/login"
            aria-label="Admin sign in"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.12] hover:text-white"
          >
            <LockKeyhole className="h-4 w-4" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-7 sm:px-7 sm:pt-10">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#167365]">
            Teacher check-in
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em] text-[#18332d] sm:text-5xl">
            Choose your class
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-[#667670]">
            Tap a class to immediately show its check-in QR code.
          </p>
        </div>

        {classes.length ? (
          <div className="mt-7">
            <TeacherClassList classes={classes} />
          </div>
        ) : (
          <div className="mt-8 rounded-[28px] border border-[#d7ddd8] bg-white p-7 text-center shadow-[0_16px_42px_rgba(24,45,39,0.06)] sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e5f2ed] text-[#167365]">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[#203b34]">
              No check-in classes are available
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6b7a75]">
              An administrator can enable a class and set its meeting time.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-xl bg-[#167365] px-4 py-3 text-sm font-semibold text-white"
            >
              Admin sign in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
