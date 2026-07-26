import "server-only";

import { ensureLeaderAttendanceForSession } from "@/lib/attendance/leader-attendance";
import { selectCurrentClassSession } from "@/lib/checkin/class-session-selection";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InternalCheckinSessionResult } from "@/lib/checkin/types";

type SessionCandidate = {
  id: string;
  title: string;
  ccb_group_id: string;
  ccb_event_id: string;
  occurrence_date: string;
  occurrence_start_at: string | null;
  occurrence_end_at: string | null;
  status: string;
  meeting_kind?: string;
  checkin_opens_at: string | null;
  checkin_closes_at: string | null;
  options: unknown;
  created_at?: string;
};

type ClassMapping = {
  ccb_group_id: string;
  group_name: string;
  ccb_event_grouping_id: string | null;
  auto_add_checkins_to_group: boolean | null;
  ccb_main_leader_id: string | null;
  enabled: boolean;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getInternalCheckinSessionByClassSlug(
  slug: string
): Promise<InternalCheckinSessionResult> {
  if (!UUID_PATTERN.test(slug)) {
    return {
      ok: false,
      reason: "not_found",
      message: "This class check-in link was not found. Please ask your group leader for the class QR code."
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: mapping, error: mappingError } = await supabase
    .from("ccb_group_mappings")
    .select(
      "ccb_group_id,group_name,ccb_event_grouping_id,auto_add_checkins_to_group,ccb_main_leader_id,enabled"
    )
    .eq("public_checkin_slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (mappingError || !mapping) {
    return {
      ok: false,
      reason: "not_found",
      message: "This class check-in link was not found. Please ask your group leader for the class QR code."
    };
  }

  const classMapping = mapping as ClassMapping;

  if (!classMapping.enabled) {
    return {
      ok: false,
      reason: "not_active",
      groupName: classMapping.group_name,
      message: "Check-in is currently disabled for this class."
    };
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from("checkin_sessions")
    .select(
      "id,title,ccb_group_id,ccb_event_id,occurrence_date,occurrence_start_at,occurrence_end_at,status,checkin_opens_at,checkin_closes_at,meeting_kind,options,created_at"
    )
    .eq("ccb_group_id", classMapping.ccb_group_id)
    .eq("status", "active")
    .order("occurrence_start_at", { ascending: false })
    .limit(50);

  if (sessionsError) {
    return {
      ok: false,
      reason: "no_meeting",
      groupName: classMapping.group_name,
      message: "We could not load this class meeting. Please try again or ask your group leader for help."
    };
  }

  let candidates = (sessions ?? []) as SessionCandidate[];
  let selected = selectCurrentClassSession(candidates);

  if (!selected) {
    const { data: scheduledSessionId } = await supabase.rpc(
      "ensure_current_class_session",
      {
        p_public_slug: slug,
        p_now: new Date().toISOString()
      }
    );

    if (scheduledSessionId) {
      const { data: scheduledSession } = await supabase
        .from("checkin_sessions")
        .select(
          "id,title,ccb_group_id,ccb_event_id,occurrence_date,occurrence_start_at,occurrence_end_at,status,checkin_opens_at,checkin_closes_at,meeting_kind,options,created_at"
        )
        .eq("id", scheduledSessionId)
        .maybeSingle();

      if (scheduledSession) {
        candidates = [scheduledSession as SessionCandidate, ...candidates];
        selected = selectCurrentClassSession(candidates);
      }
    }
  }

  if (!selected) {
    const now = new Date();
    const nextSession = candidates
      .filter(
        (session) =>
          session.status === "active" &&
          session.checkin_opens_at &&
          new Date(session.checkin_opens_at) > now
      )
      .sort(
        (left, right) =>
          new Date(left.checkin_opens_at as string).getTime() -
          new Date(right.checkin_opens_at as string).getTime()
      )[0];

    return {
      ok: false,
      reason: nextSession ? "not_open_yet" : "no_meeting",
      groupName: classMapping.group_name,
      message: nextSession
        ? "Check-in has not opened for the next meeting yet."
        : "There is no meeting open for check-in right now."
    };
  }

  const options = asObject(selected.options);
  const autoAddFromOptions = options.auto_add_checkins_to_group;
  const groupingFromOptions = options.event_grouping_id;

  await ensureLeaderAttendanceForSession({
    sessionId: selected.id,
    ccbGroupId: classMapping.ccb_group_id,
    leaderIndividualId: classMapping.ccb_main_leader_id
  }).catch(() => null);

  return {
    ok: true,
    session: {
      id: selected.id,
      title: selected.title,
      ccbGroupId: selected.ccb_group_id,
      ccbEventId: selected.ccb_event_id,
      occurrenceDate: selected.occurrence_date,
      occurrenceStartAt: selected.occurrence_start_at,
      occurrenceEndAt: selected.occurrence_end_at,
      checkinOpensAt: selected.checkin_opens_at,
      checkinClosesAt: selected.checkin_closes_at,
      status: selected.status,
      groupName: classMapping.group_name,
      eventGroupingId:
        typeof groupingFromOptions === "string" && groupingFromOptions
          ? groupingFromOptions
          : classMapping.ccb_event_grouping_id,
      autoAddCheckinsToGroup:
        typeof autoAddFromOptions === "boolean"
          ? autoAddFromOptions
          : classMapping.auto_add_checkins_to_group ?? true,
      reusableClassLink: true
    }
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
