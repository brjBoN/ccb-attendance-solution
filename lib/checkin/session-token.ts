import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashCheckinToken } from "@/lib/tokens";

export type InternalCheckinSessionResult =
  | {
      ok: true;
      session: {
        id: string;
        title: string;
        ccbGroupId: string;
        ccbEventId: string;
        occurrenceDate: string;
        occurrenceStartAt: string | null;
        occurrenceEndAt: string | null;
        checkinOpensAt: string | null;
        checkinClosesAt: string | null;
        status: string;
        groupName: string | null;
        eventGroupingId: string | null;
        autoAddCheckinsToGroup: boolean;
      };
    }
  | {
      ok: false;
      reason: "not_found" | "revoked" | "expired" | "not_active" | "not_open_yet" | "closed";
      message: string;
    };

export async function getInternalCheckinSessionByToken(
  token: string
): Promise<InternalCheckinSessionResult> {
  const supabase = createSupabaseAdminClient();
  const tokenHash = hashCheckinToken(token);

  const { data: tokenRow, error: tokenError } = await supabase
    .from("checkin_tokens")
    .select(
      `
      id,
      expires_at,
      revoked_at,
      session_id,
      checkin_sessions (
        id,
        title,
        ccb_group_id,
        ccb_event_id,
        occurrence_date,
        occurrence_start_at,
        occurrence_end_at,
        status,
        checkin_opens_at,
        checkin_closes_at,
        options
      )
    `
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return {
      ok: false,
      reason: "not_found",
      message: "This QR code was not found. Please ask your group leader for a current check-in link."
    };
  }

  if (tokenRow.revoked_at) {
    return {
      ok: false,
      reason: "revoked",
      message: "This QR code has been revoked. Please ask your group leader for a new QR code."
    };
  }

  const now = new Date();

  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < now) {
    return {
      ok: false,
      reason: "expired",
      message: "This QR code has expired. Please ask your group leader for a current check-in link."
    };
  }

  const session = Array.isArray(tokenRow.checkin_sessions)
    ? tokenRow.checkin_sessions[0]
    : tokenRow.checkin_sessions;

  if (!session) {
    return {
      ok: false,
      reason: "not_found",
      message: "This QR code is not connected to an active check-in session."
    };
  }

  if (session.status !== "active") {
    return {
      ok: false,
      reason: "not_active",
      message: "This check-in session is not currently active."
    };
  }

  if (session.checkin_opens_at && new Date(session.checkin_opens_at) > now) {
    return {
      ok: false,
      reason: "not_open_yet",
      message: "Check-in has not opened for this meeting yet."
    };
  }

  if (session.checkin_closes_at && new Date(session.checkin_closes_at) < now) {
    return {
      ok: false,
      reason: "closed",
      message: "Check-in has closed for this meeting."
    };
  }

  const { data: groupMapping } = await supabase
    .from("ccb_group_mappings")
    .select("group_name,ccb_event_grouping_id,auto_add_checkins_to_group")
    .eq("ccb_group_id", session.ccb_group_id)
    .maybeSingle();

  const options = asObject(session.options);
  const autoAddFromOptions = options.auto_add_checkins_to_group;
  const groupingFromOptions = options.event_grouping_id;

  return {
    ok: true,
    session: {
      id: session.id,
      title: session.title,
      ccbGroupId: session.ccb_group_id,
      ccbEventId: session.ccb_event_id,
      occurrenceDate: session.occurrence_date,
      occurrenceStartAt: session.occurrence_start_at,
      occurrenceEndAt: session.occurrence_end_at,
      checkinOpensAt: session.checkin_opens_at,
      checkinClosesAt: session.checkin_closes_at,
      status: session.status,
      groupName: groupMapping?.group_name ?? null,
      eventGroupingId:
        typeof groupingFromOptions === "string" && groupingFromOptions
          ? groupingFromOptions
          : groupMapping?.ccb_event_grouping_id ?? null,
      autoAddCheckinsToGroup:
        typeof autoAddFromOptions === "boolean"
          ? autoAddFromOptions
          : groupMapping?.auto_add_checkins_to_group ?? true
    }
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
