import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Radio,
  ScanLine,
  ScrollText,
  ShieldCheck,
  UserRoundPlus,
  UsersRound
} from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import {
  canCreateGroupsRole,
  isFullAdminRole
} from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const fullAdmin = isFullAdminRole(admin.role);
  const supabase = createSupabaseAdminClient();

  let classCount = 0;
  let meetingCount = 0;
  let activeMeetingCount = 0;
  let checkinCount = 0;
  let failedSyncCount = 0;

  if (fullAdmin) {
    const [classes, meetings, activeMeetings, checkins, failed] =
      await Promise.all([
        supabase
          .from("ccb_group_mappings")
          .select("*", { count: "exact", head: true })
          .eq("enabled", true)
          .is("deleted_at", null),
        supabase
          .from("checkin_sessions")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("checkin_sessions")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("attendance_checkins")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("attendance_checkins")
          .select("*", { count: "exact", head: true })
          .eq("ccb_sync_status", "failed")
      ]);
    classCount = classes.count ?? 0;
    meetingCount = meetings.count ?? 0;
    activeMeetingCount = activeMeetings.count ?? 0;
    checkinCount = checkins.count ?? 0;
    failedSyncCount = failed.count ?? 0;
  } else if (admin.ccbIndividualId) {
    const { data: mappings } = await supabase
      .from("ccb_group_mappings")
      .select("ccb_group_id")
      .eq("ccb_main_leader_id", admin.ccbIndividualId)
      .eq("enabled", true)
      .is("deleted_at", null);
    const groupIds = (mappings ?? []).map((row) => row.ccb_group_id);
    classCount = groupIds.length;

    if (groupIds.length) {
      const { data: meetings } = await supabase
        .from("checkin_sessions")
        .select("id,status")
        .in("ccb_group_id", groupIds);
      const sessionIds = (meetings ?? []).map((row) => row.id);
      meetingCount = sessionIds.length;
      activeMeetingCount =
        meetings?.filter((row) => row.status === "active").length ?? 0;

      if (sessionIds.length) {
        const [checkins, failed] = await Promise.all([
          supabase
            .from("attendance_checkins")
            .select("*", { count: "exact", head: true })
            .in("session_id", sessionIds),
          supabase
            .from("attendance_checkins")
            .select("*", { count: "exact", head: true })
            .in("session_id", sessionIds)
            .eq("ccb_sync_status", "failed")
        ]);
        checkinCount = checkins.count ?? 0;
        failedSyncCount = failed.count ?? 0;
      }
    }
  }

  const { count: pendingGuestCount } = fullAdmin
    ? await supabase
        .from("pending_people")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
    : { count: null };

  const { count: checklistOpenCount } = fullAdmin
    ? await supabase
        .from("ccb_group_setup_checklist")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "needs_review"])
    : { count: null };

  return (
    <div className="mx-auto max-w-[1240px]">
      <section className="relative overflow-hidden rounded-[32px] bg-[#12362f] px-6 py-8 text-white shadow-[0_28px_80px_rgba(18,54,47,0.2)] sm:px-9 sm:py-10">
        <div
          aria-hidden="true"
          className="absolute -right-10 -top-10 h-52 w-52 rounded-full border-[38px] border-white/[0.045]"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-8 right-24 hidden grid-cols-3 gap-2 opacity-20 md:grid"
        >
          {Array.from({ length: 9 }).map((_, index) => (
            <span
              key={index}
              className={`h-6 w-6 rounded-[5px] ${
                [0, 2, 4, 6, 7].includes(index)
                  ? "bg-[#f1b86b]"
                  : "border border-white/50"
              }`}
            />
          ))}
        </div>

        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#a8decf]">
            <Radio className="h-3.5 w-3.5" />
            Attendance workspace
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Ready for the next class.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
            Open a meeting, let members scan the class&apos;s familiar QR code,
            and watch attendance move into CCB.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin/sessions"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f1b86b] px-5 py-3 text-sm font-bold text-[#2d352b] transition hover:bg-[#f5c681]"
            >
              <ScanLine className="h-4 w-4" />
              Open a meeting
            </Link>
            <Link
              href="/admin/groups"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/18 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
            >
              Manage classes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {!fullAdmin && !admin.ccbIndividualId ? (
        <div className="mt-6 rounded-2xl border border-[#ead9b4] bg-[#fff8e8] p-5 text-sm leading-6 text-[#705829]">
          Your account still needs a CCB individual ID. A full administrator can
          connect it on the Permissions page before you manage class
          attendance.
        </div>
      ) : null}

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Your classes"
          value={classCount}
          detail="Reusable QR codes"
          tone="mint"
        />
        <Metric
          label="Open now"
          value={activeMeetingCount}
          detail="Taking attendance"
          tone="amber"
        />
        <Metric
          label="Total meetings"
          value={meetingCount}
          detail="Attendance history"
          tone="neutral"
        />
        <Metric
          label="Check-ins"
          value={checkinCount}
          detail={
            failedSyncCount
              ? `${failedSyncCount} need attention`
              : "CCB sync looks clear"
          }
          tone={failedSyncCount ? "rose" : "neutral"}
        />
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="surface-card p-6 sm:p-7">
          <p className="text-sm font-semibold text-[#167365]">
            How check-in works
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#18332d]">
            A simpler rhythm for every class
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <Step
              number="01"
              title="Keep one code"
              body="Each class gets a permanent QR code and link."
            />
            <Step
              number="02"
              title="Open a meeting"
              body="Set the check-in window when class begins."
            />
            <Step
              number="03"
              title="Members scan"
              body="The familiar class code records today's attendance."
            />
          </div>
        </div>

        <div className="surface-card p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#167365]">
                Needs attention
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#18332d]">
                Operations
              </h2>
            </div>
            {failedSyncCount + (pendingGuestCount ?? 0) + (checklistOpenCount ?? 0) ===
            0 ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e1f3ed] text-[#167365]">
                <CheckCircle2 className="h-5 w-5" />
              </span>
            ) : null}
          </div>

          <div className="mt-5 divide-y divide-[#e5e8e3]">
            <OperationRow
              label="Failed CCB syncs"
              value={failedSyncCount}
              href="/admin/logs"
            />
            {fullAdmin ? (
              <OperationRow
                label="Guests waiting"
                value={pendingGuestCount ?? 0}
                href="/admin/guests"
              />
            ) : null}
            {fullAdmin ? (
              <OperationRow
                label="Checklist items"
                value={checklistOpenCount ?? 0}
                href="/admin/checklist"
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-[#167365]">Shortcuts</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#18332d]">
              Keep things moving
            </h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            icon={<UsersRound className="h-5 w-5" />}
            title="Classes"
            body={
              canCreateGroupsRole(admin.role)
                ? "Connect and configure CCB classes."
                : "View the classes you lead."
            }
            href="/admin/groups"
          />
          <ActionCard
            icon={<ScrollText className="h-5 w-5" />}
            title="Activity"
            body="Review check-ins and retry attendance syncs."
            href="/admin/logs"
          />
          {fullAdmin ? (
            <ActionCard
              icon={<UserRoundPlus className="h-5 w-5" />}
              title="Guest review"
              body="Connect visitors to an existing or new CCB profile."
              href="/admin/guests"
            />
          ) : null}
          {fullAdmin ? (
            <ActionCard
              icon={<ClipboardCheck className="h-5 w-5" />}
              title="CCB checklist"
              body="Finish CCB-only settings for each class."
              href="/admin/checklist"
            />
          ) : null}
          {fullAdmin ? (
            <ActionCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Permissions"
              body="Assign app roles and connect CCB identities."
              href="/admin/permissions"
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value: number;
  detail: string;
  tone: "mint" | "amber" | "rose" | "neutral";
}) {
  const accent = {
    mint: "bg-[#dff3ec] text-[#12675b]",
    amber: "bg-[#fff1d9] text-[#805b22]",
    rose: "bg-[#fff0ec] text-[#9a4639]",
    neutral: "bg-[#eceeea] text-[#53655e]"
  }[tone];

  return (
    <div className="rounded-2xl border border-[#dce1db] bg-white p-5 shadow-[0_12px_35px_rgba(24,45,39,0.05)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.11em] text-[#71807b]">
          {label}
        </p>
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
      </div>
      <p className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#18332d]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[#7a8984]">{detail}</p>
    </div>
  );
}

function Step({
  number,
  title,
  body
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <span className="text-xs font-bold tracking-[0.16em] text-[#d18b38]">
        {number}
      </span>
      <h3 className="mt-3 font-semibold text-[#234039]">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[#71807b]">{body}</p>
    </div>
  );
}

function OperationRow({
  label,
  value,
  href
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 py-3.5 text-sm transition first:pt-0 last:pb-0 hover:text-[#167365]"
    >
      <span className="font-medium text-[#4c625b]">{label}</span>
      <span className="flex items-center gap-2 font-semibold">
        {value}
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

function ActionCard({
  icon,
  title,
  body,
  href
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#dce1db] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#bfcfc7] hover:shadow-[0_16px_38px_rgba(24,45,39,0.08)]"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e5f3ee] text-[#167365]">
          {icon}
        </span>
        <ArrowRight className="h-4 w-4 text-[#9aa6a1] transition group-hover:translate-x-1 group-hover:text-[#167365]" />
      </div>
      <h3 className="mt-4 font-semibold text-[#203b34]">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[#71807b]">{body}</p>
    </Link>
  );
}
