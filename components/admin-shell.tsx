"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  LayoutDashboard,
  ScanLine,
  ScrollText,
  Settings,
  ShieldCheck,
  UserRoundPlus,
  UsersRound
} from "lucide-react";
import type { CurrentAdmin } from "@/lib/auth/admin";
import { isFullAdminRole } from "@/lib/auth/permissions";
import { SignOutButton } from "@/components/sign-out-button";

const nav = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    fullAdminOnly: false
  },
  {
    href: "/admin/groups",
    label: "Classes",
    icon: UsersRound,
    fullAdminOnly: false
  },
  {
    href: "/admin/sessions",
    label: "Schedules",
    icon: ScanLine,
    fullAdminOnly: false
  },
  {
    href: "/admin/guests",
    label: "Guest review",
    icon: UserRoundPlus,
    fullAdminOnly: true
  },
  {
    href: "/admin/checklist",
    label: "CCB checklist",
    icon: ClipboardCheck,
    fullAdminOnly: true
  },
  {
    href: "/admin/permissions",
    label: "Permissions",
    icon: ShieldCheck,
    fullAdminOnly: true
  },
  {
    href: "/admin/logs",
    label: "Activity",
    icon: ScrollText,
    fullAdminOnly: false
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    fullAdminOnly: false
  }
];

export function AdminShell({
  admin,
  children
}: {
  admin: CurrentAdmin;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const visibleNav = nav.filter(
    (item) => !item.fullAdminOnly || isFullAdminRole(admin.role)
  );

  return (
    <div className="min-h-screen bg-[#f3f2ec]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[276px] flex-col bg-[#12362f] p-4 text-white lg:flex">
        <Link
          href="/admin"
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

        <nav className="mt-6 flex-1 space-y-1">
          {visibleNav.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-[#dff3ec] text-[#153b33] shadow-sm"
                    : "text-white/68 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

      </aside>

      <div className="lg:pl-[276px]">
        <header className="sticky top-0 z-20 border-b border-[#dfe2dc] bg-[#f8f7f2]/90 backdrop-blur-xl">
          <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Link
              href="/admin"
              className="flex items-center gap-2.5 lg:hidden"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#12362f] text-[#f1b86b]">
                <ScanLine className="h-5 w-5" />
              </span>
              <span className="text-sm font-bold text-[#18332d]">
                Heritage Attendance
              </span>
            </Link>

            <div className="hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7a8984]">
                Attendance workspace
              </p>
              <p className="mt-1 text-sm font-semibold text-[#29473f]">
                {admin.name || admin.email}
                <span className="ml-2 rounded-full bg-[#e3ebe7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#4e655e]">
                  {admin.role.replace("_", " ")}
                </span>
              </p>
            </div>

            <SignOutButton />
          </div>

          <nav className="flex gap-1 overflow-x-auto border-t border-[#e7e8e2] px-3 py-2 lg:hidden">
            {visibleNav.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                    active
                      ? "bg-[#dff3ec] text-[#145f53]"
                      : "text-[#667670]"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
