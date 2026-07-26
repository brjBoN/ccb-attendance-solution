import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  QrCode,
  ScrollText,
  Settings,
  ShieldCheck,
  UserRoundPlus,
  UsersRound
} from "lucide-react";
import {
  getAdminDestinations,
  type AdminDestinationKey
} from "@/lib/admin/destinations";
import { requireAdmin } from "@/lib/auth/admin";
import {
  APP_ROLE_LABELS,
  isFullAdminRole
} from "@/lib/auth/permissions";

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

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const destinations = getAdminDestinations(admin.role);
  const needsCcbLink =
    !isFullAdminRole(admin.role) && !admin.ccbIndividualId;

  return (
    <div className="mx-auto max-w-[1120px]">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#167365]">
            Admin mode
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em] text-[#18332d] sm:text-5xl">
            Manage attendance
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#667670]">
            Choose the part of the system you need to update.
          </p>
        </div>
        <div className="w-fit rounded-full border border-[#d5ddd8] bg-white px-3.5 py-2 text-xs font-bold text-[#566b64]">
          {APP_ROLE_LABELS[admin.role]}
        </div>
      </section>

      {needsCcbLink ? (
        <div className="mt-6 rounded-2xl border border-[#ead9b4] bg-[#fff8e8] p-4 text-sm leading-6 text-[#705829]">
          Your account needs to be connected to your CCB profile before your
          class schedules and attendance activity can appear.
        </div>
      ) : null}

      <section className="mt-7">
        <Link
          href="/teacher"
          className="group flex items-center justify-between gap-5 overflow-hidden rounded-[26px] bg-[#12362f] p-5 text-white shadow-[0_20px_55px_rgba(18,54,47,0.2)] transition active:scale-[0.99] sm:p-6 sm:hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f1b86b] text-[#31382d]">
              <QrCode className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#a8decf]">
                Teacher check-in
              </p>
              <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
                Show a class QR code
              </h2>
              <p className="mt-1 hidden text-sm text-white/60 sm:block">
                Open the public class finder and choose a class.
              </p>
            </div>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 transition group-hover:translate-x-1">
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <p className="text-sm font-semibold text-[#167365]">Admin tools</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#18332d]">
            What do you need to manage?
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map((destination) => {
            const Icon = icons[destination.key];
            const emphasized = destination.key === "schedules";
            return (
              <Link
                key={destination.key}
                href={destination.href}
                className={`group flex min-h-[178px] flex-col rounded-[24px] border p-5 transition active:scale-[0.99] sm:hover:-translate-y-0.5 sm:hover:shadow-[0_16px_40px_rgba(24,45,39,0.09)] ${
                  emphasized
                    ? "border-[#bfd8cf] bg-[#e4f1ec]"
                    : "border-[#d9dfda] bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                      emphasized
                        ? "bg-[#167365] text-white"
                        : "bg-[#edf3ef] text-[#167365]"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#8b9994] transition group-hover:translate-x-1 group-hover:text-[#167365]" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#203b34]">
                  {destination.label}
                </h3>
                <p className="mt-1 text-sm leading-6 text-[#6d7c77]">
                  {destination.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
