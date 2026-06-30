import Link from "next/link";
import {
  ClipboardCheck,
  Database,
  ListChecks,
  QrCode,
  ShieldCheck,
  UserPlus
} from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { canCreateGroupsRole, isFullAdminRole } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const fullAdmin = isFullAdminRole(admin.role);
  const supabase = createSupabaseAdminClient();

  let sessionCount = 0;
  let checkinCount = 0;
  let failedSyncCount = 0;

  if (fullAdmin) {
    const [sessions, checkins, failed] = await Promise.all([
      supabase.from("checkin_sessions").select("*", { count: "exact", head: true }),
      supabase.from("attendance_checkins").select("*", { count: "exact", head: true }),
      supabase.from("attendance_checkins").select("*", { count: "exact", head: true }).eq("ccb_sync_status", "failed")
    ]);
    sessionCount = sessions.count ?? 0;
    checkinCount = checkins.count ?? 0;
    failedSyncCount = failed.count ?? 0;
  } else if (admin.ccbIndividualId) {
    const { data: mappings } = await supabase
      .from("ccb_group_mappings")
      .select("ccb_group_id")
      .eq("ccb_main_leader_id", admin.ccbIndividualId);
    const groupIds = (mappings ?? []).map((row) => row.ccb_group_id);

    if (groupIds.length) {
      const { data: sessions } = await supabase
        .from("checkin_sessions")
        .select("id")
        .in("ccb_group_id", groupIds);
      const sessionIds = (sessions ?? []).map((row) => row.id);
      sessionCount = sessionIds.length;

      if (sessionIds.length) {
        const [checkins, failed] = await Promise.all([
          supabase.from("attendance_checkins").select("*", { count: "exact", head: true }).in("session_id", sessionIds),
          supabase.from("attendance_checkins").select("*", { count: "exact", head: true }).in("session_id", sessionIds).eq("ccb_sync_status", "failed")
        ]);
        checkinCount = checkins.count ?? 0;
        failedSyncCount = failed.count ?? 0;
      }
    }
  }

  const { count: pendingGuestCount } = fullAdmin
    ? await supabase.from("pending_people").select("*", { count: "exact", head: true }).eq("status", "pending")
    : { count: null };

  const { count: checklistOpenCount } = fullAdmin
    ? await supabase
        .from("ccb_group_setup_checklist")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "needs_review"])
    : { count: null };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Admin Dashboard</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Role-aware access is active. QR session creation is limited to full administrators and each group&apos;s linked CCB main leader.
        </p>
      </div>

      {!fullAdmin && !admin.ccbIndividualId ? (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          Your account is not linked to a CCB individual ID. A full administrator must set it on the Permissions page before you can create QR sessions for groups you lead.
        </div>
      ) : null}

      <div className={`mb-8 grid gap-4 ${fullAdmin ? "md:grid-cols-5" : "md:grid-cols-3"}`}>
        <Metric label="Authorized sessions" value={sessionCount} />
        <Metric label="Check-ins" value={checkinCount} />
        <Metric label="Failed syncs" value={failedSyncCount} />
        {fullAdmin ? <Metric label="Pending guests" value={pendingGuestCount ?? 0} /> : null}
        {fullAdmin ? <Metric label="Checklist open" value={checklistOpenCount ?? 0} /> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <DashboardCard icon={<Database className="h-5 w-5" />} title="Groups" body={canCreateGroupsRole(admin.role) ? "Search, create, and edit CCB groups." : "Search CCB groups and view their QR mappings."} href="/admin/groups" cta="Open groups" />
        <DashboardCard icon={<QrCode className="h-5 w-5" />} title="QR sessions" body="Create and manage QR sessions for groups you are authorized to lead." href="/admin/sessions" cta="Open sessions" />
        <DashboardCard icon={<ListChecks className="h-5 w-5" />} title="Sync logs" body="View check-in attempts and retry attendance sync." href="/admin/logs" cta="Open logs" />
        {fullAdmin ? <DashboardCard icon={<UserPlus className="h-5 w-5" />} title="Guest review" body="Review pending guest/new-person submissions." href="/admin/guests" cta="Open guests" /> : null}
        {fullAdmin ? <DashboardCard icon={<ClipboardCheck className="h-5 w-5" />} title="CCB checklist" body="Complete CCB web-only group settings." href="/admin/checklist" cta="Open checklist" /> : null}
        {fullAdmin ? <DashboardCard icon={<ShieldCheck className="h-5 w-5" />} title="Permissions" body="View every Auth user and assign app roles and CCB IDs." href="/admin/permissions" cta="Manage users" /> : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p></div>;
}

function DashboardCard({ icon, title, body, href, cta }: { icon: React.ReactNode; title: string; body: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</div>
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      <Link href={href} className="mt-5 inline-flex text-sm font-semibold text-brand-700 hover:underline">{cta}</Link>
    </div>
  );
}
