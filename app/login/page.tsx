import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { safeAuthRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Admin Sign In"
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [admin, query] = await Promise.all([getCurrentAdmin(), searchParams]);
  const next = safeAuthRedirectPath(query.next);
  if (admin) redirect(next);

  return (
    <main className="grid min-h-screen bg-[#f4f8fc] lg:grid-cols-[0.9fr_1.1fr]">
      <section className="relative hidden overflow-hidden bg-[#071f3f] p-12 text-white lg:flex lg:flex-col lg:justify-between">
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
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#74d9f1]">
            Heritage Church admin
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.045em]">
            Make every welcome count.
          </h1>
          <p className="mt-5 text-lg leading-8 text-white/65">
            Manage group schedules, pending guests, permissions, and CCB
            attendance from one place.
          </p>
          <div className="mt-8 space-y-3 text-sm text-white/75">
            <Benefit>Set regular and special group times</Benefit>
            <Benefit>Review pending guest submissions</Benefit>
            <Benefit>Monitor protected CCB attendance sync</Benefit>
          </div>
        </div>

        <p className="relative text-xs text-white/35">
          Protected access for Heritage Church attendance administrators.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 rounded-2xl bg-[#071f3f] px-4 py-3 lg:hidden">
            <Image
              src="/heritage-church-logo.png"
              alt="Heritage Church"
              width={512}
              height={288}
              priority
              className="h-auto w-full max-w-[220px] mix-blend-screen"
            />
          </div>
          <AuthForm next={next} initialMessage={query.error ?? null} />
          <Link
            href="/teacher"
            className="mt-5 flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-[#0866ff] transition hover:bg-white/55"
          >
            Leader check-in does not need a login
          </Link>
        </div>
      </section>
    </main>
  );
}

function Benefit({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle2 className="h-4 w-4 text-[#0099cb]" />
      {children}
    </div>
  );
}
