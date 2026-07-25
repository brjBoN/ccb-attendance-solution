import "server-only";

import { ensureLeaderAttendanceForSession } from "@/lib/attendance/leader-attendance";
import { buildAttendanceRoster } from "@/lib/attendance/roster";
import { createCcbClient } from "@/lib/ccb/client";
import { CcbClientError } from "@/lib/ccb/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AttendanceSyncResult =
  | { ok: true; status: "synced"; message: string; attendeeCount: number }
  | { ok: false; status: "failed"; message: string };

export async function syncAttendanceCheckin(checkinId: string): Promise<AttendanceSyncResult> {
  const supabase = createSupabaseAdminClient();

  const { data: checkin, error } = await supabase
    .from("attendance_checkins")
    .select(
      `
      id,
      session_id,
      ccb_individual_id,
      checkin_sessions (
        id,
        ccb_group_id,
        ccb_event_id,
        occurrence_date,
        occurrence_start_at,
        options
      )
    `
    )
    .eq("id", checkinId)
    .single();

  if (error || !checkin) {
    return { ok: false, status: "failed", message: error?.message ?? "Check-in not found." };
  }

  const session = Array.isArray(checkin.checkin_sessions)
    ? checkin.checkin_sessions[0]
    : checkin.checkin_sessions;

  if (!session) {
    await markFailed(checkinId, "Session not found for this check-in.");
    return { ok: false, status: "failed", message: "Session not found for this check-in." };
  }

  const occurrence = resolveCcbOccurrence(session);
  const client = createCcbClient();

  try {
    const leaderAttendance = await ensureLeaderAttendanceForSession({
      sessionId: session.id,
      ccbGroupId: session.ccb_group_id
    });

    const existing = await client.getAttendanceProfile({
      eventId: session.ccb_event_id,
      occurrence
    });

    const { data: localRows, error: localError } = await supabase
      .from("attendance_checkins")
      .select("id,ccb_individual_id")
      .eq("session_id", session.id)
      .not("ccb_individual_id", "is", null);

    if (localError) throw new Error(localError.message);

    const uniqueIds = buildAttendanceRoster({
      existingCcbIds: existing.attendees.map((person) => person.id),
      localCcbIds: (localRows ?? []).map((row) => row.ccb_individual_id),
      leaderCcbId: leaderAttendance?.ccbIndividualId
    });

    await client.createEventAttendance({
      eventId: session.ccb_event_id,
      occurrence,
      individualIds: uniqueIds,
      didNotMeet: false,
      headCount: Math.max(existing.headCount ?? 0, uniqueIds.length),
      topic: existing.topic ?? undefined,
      notes: existing.notes ?? undefined,
      prayerRequests: existing.prayerRequests ?? undefined,
      info: existing.info ?? undefined,
      emailNotification: "none"
    });

    const verified = await client.getAttendanceProfile({
      eventId: session.ccb_event_id,
      occurrence
    });

    const verifiedIds = new Set(verified.attendees.map((person) => person.id));
    const missing = uniqueIds.filter((id) => !verifiedIds.has(id));
    if (missing.length > 0) {
      throw new Error(`CCB attendance verification failed for individual IDs: ${missing.join(", ")}`);
    }

    const now = new Date().toISOString();
    await supabase
      .from("attendance_checkins")
      .update({
        status: "success",
        ccb_sync_status: "synced",
        ccb_synced_at: now,
        error_message: null
      })
      .eq("session_id", session.id)
      .not("ccb_individual_id", "is", null);

    await supabase.from("audit_logs").insert({
      actor_type: "system",
      action: "attendance_roster_merged_and_synced",
      target_type: "checkin_session",
      target_id: session.id,
      metadata_json: {
        ccb_event_id: session.ccb_event_id,
        occurrence,
        attendee_count: uniqueIds.length
      }
    });

    return {
      ok: true,
      status: "synced",
      message: `Attendance was synced to CCB with ${uniqueIds.length} attendee${uniqueIds.length === 1 ? "" : "s"}.`,
      attendeeCount: uniqueIds.length
    };
  } catch (error) {
    const message =
      error instanceof CcbClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown CCB sync error.";

    await markFailed(checkinId, message);
    return { ok: false, status: "failed", message };
  }
}

function resolveCcbOccurrence(session: {
  occurrence_date: string;
  occurrence_start_at: string | null;
  options: unknown;
}) {
  const options = asObject(session.options);
  const explicit = typeof options.ccb_occurrence === "string" ? options.ccb_occurrence : null;
  if (explicit) return explicit;

  if (session.occurrence_start_at) {
    const date = new Date(session.occurrence_start_at);
    if (!Number.isNaN(date.valueOf())) {
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
    }
  }

  return `${session.occurrence_date} 00:00:00`;
}

async function markFailed(checkinId: string, message: string) {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("attendance_checkins")
    .update({
      status: "pending",
      ccb_sync_status: "failed",
      error_message: message
    })
    .eq("id", checkinId);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
