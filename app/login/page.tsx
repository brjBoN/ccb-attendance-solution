import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Leader Sign In"
};

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-[#f3f2ec] lg:grid-cols-[0.9fr_1.1fr]">
      <section className="relative hidden overflow-hidden bg-[#12362f] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="absolute -right-20 top-24 h-80 w-80 rounded-full border-[56px] border-white/[0.04]"
        />
        <Image
          src="/heritage-church-logo.png"
          alt="Heritage Church"
          width={512}
          height={288}
          priority
          className="relative h-auto w-full max-w-[270px] mix-blend-screen"
        />

        <div className="relative max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#a8decf]">
            Heritage Church attendance
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.045em]">
            Make every welcome count.
          </h1>
          <p className="mt-5 text-lg leading-8 text-white/65">
            Give class leaders a clear weekly rhythm for attendance and keep
            CCB up to date with less setup.
          </p>
          <div className="mt-8 space-y-3 text-sm text-white/75">
            <Benefit>Automatic schedule-based check-in</Benefit>
            <Benefit>Fast member and guest arrival</Benefit>
            <Benefit>Protected CCB attendance sync</Benefit>
          </div>
        </div>

        <p className="relative text-xs text-white/35">
          Built for Heritage Church class leaders and attendance teams.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 rounded-2xl bg-[#12362f] px-4 py-3 lg:hidden">
            <Image
              src="/heritage-church-logo.png"
              alt="Heritage Church"
              width={512}
              height={288}
              priority
              className="h-auto w-full max-w-[220px] mix-blend-screen"
            />
          </div>
          <AuthForm />
        </div>
      </section>
    </main>
  );
}

function Benefit({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle2 className="h-4 w-4 text-[#f1b86b]" />
      {children}
    </div>
  );
}
