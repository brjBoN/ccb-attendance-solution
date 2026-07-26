"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  Home,
  LayoutDashboard,
  QrCode,
  ScrollText,
  Settings,
  ShieldCheck,
  UserRoundPlus,
  UsersRound
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import type { CurrentAdmin } from "@/lib/auth/admin";
import {
  getAdminDestinations,
  type AdminDestinationKey
} from "@/lib/admin/destinations";

const icons: Record<
  AdminDestinationKey,
  React.ComponentType<{ className?: string }>
> = {
  classes: UsersRound,
  schedules: CalendarClock,
  guests: UserRoundPlus,
  checklist: ClipboardCheck,
  permissions: ShieldCheck,
  activity: ScrollText,
  settings: Settings
};

export function AdminShell({
  admin,
  children
}: {
  admin: CurrentAdmin;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const destinations = getAdminDestinations(admin.role);
  const onAdminHome = pathname === "/admin";
  const mobileBackHref = onAdminHome ? "/" : "/admin";
  const mobileBackLabel = onAdminHome ? "Start" : "Admin";

  return (
    <div className="min-h-screen bg-[#f3f2ec]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[276px] flex-col bg-[#12362f] p-4 text-white lg:flex">
        <Link
          href="/"
          className="flex min-h-[104px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
        >
          <Image
            src="/heritage-church-logo.png"
            alt="Heritage Church"
            width={512}
            height={288}
            priority
            className="h-auto w-full max-w-[220px] mix-blend-screen"
          />
        </Link>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2 text-xs font-semibold text-white/72 transition hover:bg-white/[0.09] hover:text-white"
          >
            <Home className="h-4 w-4" />
            Start
          </Link>
          <Link
            href="/teacher"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#f1b86b]/30 bg-[#f1b86b]/10 px-2 text-xs font-semibold text-[#f5c985] transition hover:bg-[#f1b86b]/15"
          >
            <QrCode className="h-4 w-4" />
            Check in
          </Link>
        </div>

        <nav className="mt-5 flex-1 space-y-1 overflow-y-auto">
          <AdminNavLink
            href="/admin"
            label="Admin home"
            active={onAdminHome}
            icon={LayoutDashboard}
          />
          {destinations.map((item) => {
            const Icon = icons[item.key];
            return (
              <AdminNavLink
                key={item.href}
                href={item.href}
                label={item.shortLabel}
                active={pathname.startsWith(item.href)}
                icon={Icon}
              />
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-[276px]">
        <header className="sticky top-0 z-20 border-b border-[#dfe2dc] bg-[#f8f7f2]/95 backdrop-blur-xl">
          <div className="flex min-h-[68px] items-center justify-between gap-4 px-3 sm:px-6 lg:min-h-[72px] lg:px-8">
            <Link
              href={mobileBackHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[#29473f] transition hover:bg-[#eef1ed] lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
              {mobileBackLabel}
            </Link>

            <div className="hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7a8984]">
                Admin mode
              </p>
              <p className="mt-1 text-sm font-semibold text-[#29473f]">
                {admin.name || admin.email}
                <span className="ml-2 rounded-full bg-[#e3ebe7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#4e655e]">
                  {admin.role.replace("_", " ")}
                </span>
              </p>
            </div>

            <p className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-[#18332d] lg:hidden">
              {onAdminHome ? "Admin" : "Heritage Admin"}
            </p>

            <SignOutButton compact />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminNavLink({
  href,
  label,
  active,
  icon: Icon
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-[#dff3ec] text-[#153b33] shadow-sm"
          : "text-white/68 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </Link>
  );
}
