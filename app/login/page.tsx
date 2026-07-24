import type { Metadata } from "next";
import { CheckCircle2, ScanLine } from "lucide-react";
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
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1b86b] text-[#26362d]">
            <ScanLine className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-[#a8decf]">
              CCB
            </span>
            <span className="block font-semibold">Class Check-In</span>
          </span>
        </div>

        <div className="relative max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#a8decf]">
            A simpler Sunday
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.045em]">
            One class code. Every meeting.
          </h1>
          <p className="mt-5 text-lg leading-8 text-white/65">
            Open attendance, welcome people, and keep CCB up to date without
            making members chase a new QR code.
          </p>
          <div className="mt-8 space-y-3 text-sm text-white/75">
            <Benefit>Permanent class QR codes</Benefit>
            <Benefit>Fast mobile check-in</Benefit>
            <Benefit>Protected CCB attendance sync</Benefit>
          </div>
        </div>

        <p className="relative text-xs text-white/35">
          Built for group leaders and attendance teams.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#12362f] text-[#f1b86b]">
              <ScanLine className="h-5 w-5" />
            </span>
            <span className="font-bold text-[#18332d]">CCB Class Check-In</span>
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
