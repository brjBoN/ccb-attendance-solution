import Link from "next/link";
import {
  CalendarCheck,
  ClipboardCheck,
  Home,
  QrCode,
  Settings,
  ShieldCheck,
  UserPlus,
  UsersRound
} from "lucide-react";
import type { CurrentAdmin } from "@/lib/auth/admin";
import { isFullAdminRole } from "@/lib/auth/permissions";
import { SignOutButton } from "@/components/sign-out-button";

const nav = [
  { href: "/admin", label: "Dashboard", icon: Home, fullAdminOnly: false },
  { href: "/admin/groups", label: "Groups", icon: UsersRound, fullAdminOnly: false },
  { href: "/admin/sessions", label: "QR Sessions", icon: QrCode, fullAdminOnly: false },
  { href: "/admin/guests", label: "Pending Guests", icon: UserPlus, fullAdminOnly: true },
  { href: "/admin/checklist", label: "CCB Checklist", icon: ClipboardCheck, fullAdminOnly: true },
  { href: "/admin/permissions", label: "Permissions", icon: ShieldCheck, fullAdminOnly: true },
  { href: "/admin/logs", label: "Logs", icon: CalendarCheck, fullAdminOnly: false },
  { href: "/admin/settings", label: "Settings", icon: Settings, fullAdminOnly: false }
];

export function AdminShell({ admin, children }: { admin: CurrentAdmin; children: React.ReactNode }) {
  const visibleNav = nav.filter((item) => !item.fullAdminOnly || isFullAdminRole(admin.role));

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-4 lg:block">
        <Link href="/admin" className="block rounded-2xl bg-brand-50 p-4">
          <p className="text-sm font-medium text-brand-700">CCB QR</p>
          <p className="mt-1 text-lg font-bold text-brand-900">Attendance</p>
        </Link>

        <nav className="mt-6 space-y-1">
          {visibleNav.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950">
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Signed in as</p>
              <p className="font-semibold text-slate-950">
                {admin.name || admin.email}
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {admin.role.replace("_", " ")}
                </span>
              </p>
              {admin.ccbIndividualId ? <p className="text-xs text-slate-500">CCB individual ID {admin.ccbIndividualId}</p> : null}
            </div>
            <SignOutButton />
          </div>
        </header>

        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
