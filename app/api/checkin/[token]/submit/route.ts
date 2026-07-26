import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { ensureCcbGroupParticipant } from "@/lib/attendance/group-membership";
import { signProfileUpdateTicket } from "@/lib/checkin/profile-update-ticket";
import { getInternalCheckinSessionByToken } from "@/lib/checkin/session-token";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncAttendanceCheckin } from "@/lib/attendance/sync";
import { checkPublicRateLimit } from "@/lib/security/rate-limit";

const submitSchema = z.object({
  ccbIndividualId: z.string().trim().regex(/^\d{1,20}$/),
  displayName: z.string().trim().max(160).optional().or(z.literal("")),
  idempotencyKey: z.string().trim().max(160).optional().or(z.literal(""))
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const rate = await checkPublicRateLimit(request, `submit:${token.slice(0, 16)}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rate.retryAfterSeconds} seconds.` },
      { status: 429 }
    );
  }

  const sessionResult = await getInternalCheckinSessionByToken(token);

  if (!sessionResult.ok) {
    return NextResponse.json(
      { error: sessionResult.message, reason: sessionResult.reason },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid check-in submission.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const session = sessionResult.session;
  const individualId = parsed.data.ccbIndividualId;
  const profileUpdateTicket = signProfileUpdateTicket(
    { sessionId: session.id, individualId },
    getServerEnv().SUPABASE_SERVICE_ROLE_KEY
  );
  const idempotencyKey =
    parsed.data.idempotencyKey ||
    crypto
      .createHash("sha256")
      .update(`${session.id}:${individualId}`)
      .digest("hex");

  const { data: existing, error: existingError } = await supabase
    .from("attendance_checkins")
    .select("id,status,ccb_sync_status,created_at")
    .eq("session_id", session.id)
    .eq("ccb_individual_id", individualId)
    .in("status", ["pending", "success", "duplicate", "needs_review"])
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({
      status: "already_checked_in",
      message: "You are already checked in for this session.",
      checkin: existing,
      profileUpdateTicket
    });
  }

  const groupMembership = await ensureCcbGroupParticipant({
    individualId,
    groupId: session.ccbGroupId,
    enabled: session.autoAddCheckinsToGroup
  });

  const { data: checkin, error: insertError } = await supabase
    .from("attendance_checkins")
    .insert({
      session_id: session.id,
      ccb_individual_id: individualId,
      source: "qr",
      status: "success",
      ccb_sync_status: "not_synced",
      idempotency_key: idempotencyKey,
      metadata: {
        display_name: parsed.data.displayName || null,
        phase: "v1_1_2_existing_person_checkin",
        ccb_group_id: session.ccbGroupId,
        ccb_group_membership_status: groupMembership.status,
        ccb_group_membership_message: groupMembership.message,
        auto_add_checkins_to_group: session.autoAddCheckinsToGroup,
        event_grouping_id: session.eventGroupingId
      }
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({
        status: "already_checked_in",
        message: "You are already checked in for this session.",
        profileUpdateTicket
      });
    }

    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const sync = await syncAttendanceCheckin(checkin.id);
  const message = buildSuccessMessage(sync.message, groupMembership);

  await supabase.from("audit_logs").insert({
    actor_type: "public",
    actor_id: individualId,
    action: "attendance_checkin_submitted",
    target_type: "checkin_session",
    target_id: session.id,
    metadata_json: {
      sync_status: sync.status,
      sync_message: sync.message,
      ccb_group_id: session.ccbGroupId,
      ccb_group_membership_status: groupMembership.status,
      ccb_group_membership_message: groupMembership.message
    }
  });

  return NextResponse.json({
    status: sync.status === "synced" ? "checked_in_synced" : "checked_in_local",
    message,
    groupMembership,
    checkin,
    profileUpdateTicket
  });
}

function buildSuccessMessage(
  syncMessage: string,
  groupMembership: Awaited<ReturnType<typeof ensureCcbGroupParticipant>>
) {
  const parts = [syncMessage];

  if (groupMembership.ok) {
    if (groupMembership.status === "added") parts.push("You were added to the CCB group.");
    if (groupMembership.status === "already_member") parts.push("You were already in the CCB group.");
    if (groupMembership.status === "skipped") parts.push("You were not added to the CCB group because auto-add is disabled for this session.");
  } else {
    parts.push(`Attendance was processed, but adding you to the CCB group failed: ${groupMembership.message}`);
  }

  return parts.join(" ");
}
