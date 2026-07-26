import { NextRequest, NextResponse } from "next/server";
import {
  normalizeProfileUpdateRequest,
  profileUpdateRequestSchema
} from "@/lib/checkin/profile-update-request";
import { verifyProfileUpdateTicket } from "@/lib/checkin/profile-update-ticket";
import { getInternalCheckinSessionByToken } from "@/lib/checkin/session-token";
import { getServerEnv } from "@/lib/env";
import { checkPublicRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_PROFILE_REQUESTS_PER_PERSON_PER_HOUR = 3;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const parsed = profileUpdateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Enter a valid new email, mobile phone, or home phone.",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const input = normalizeProfileUpdateRequest(parsed.data);
  const ticket = verifyProfileUpdateTicket(
    input.ticket,
    getServerEnv().SUPABASE_SERVICE_ROLE_KEY
  );

  if (!ticket) {
    return NextResponse.json(
      { error: "This update link has expired. Check in again and retry." },
      { status: 401 }
    );
  }

  const sessionResult = await getInternalCheckinSessionByToken(token);
  if (!sessionResult.ok) {
    return NextResponse.json(
      { error: sessionResult.message, reason: sessionResult.reason },
      { status: 400 }
    );
  }

  if (sessionResult.session.id !== ticket.sessionId) {
    return NextResponse.json(
      { error: "This update link does not match the current group meeting." },
      { status: 403 }
    );
  }

  const rate = await checkPublicRateLimit(
    request,
    `profile-update:${ticket.sessionId}:${ticket.individualId}`
  );
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Too many update attempts. Try again in ${rate.retryAfterSeconds} seconds.`
      },
      { status: 429 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: checkin, error: checkinError } = await supabase
    .from("attendance_checkins")
    .select("id")
    .eq("session_id", ticket.sessionId)
    .eq("ccb_individual_id", ticket.individualId)
    .in("status", ["pending", "success", "duplicate", "needs_review"])
    .maybeSingle();

  if (checkinError || !checkin) {
    return NextResponse.json(
      { error: "Complete check-in before requesting a profile update." },
      { status: 403 }
    );
  }

  const { data: exactRequest } = await supabase
    .from("profile_update_requests")
    .select("id,status,created_at")
    .eq("ticket_jti", ticket.ticketId)
    .maybeSingle();

  if (exactRequest) {
    return NextResponse.json({
      status: exactRequest.status,
      message: "Your profile update request was already sent.",
      request: exactRequest
    });
  }

  const { data: activeRequest } = await supabase
    .from("profile_update_requests")
    .select("id,status,created_at")
    .eq("ccb_individual_id", ticket.individualId)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (activeRequest) {
    return NextResponse.json({
      status: activeRequest.status,
      message:
        "A profile update for this person is already waiting for administrator review.",
      request: activeRequest
    });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("profile_update_requests")
    .select("id", { count: "exact", head: true })
    .eq("ccb_individual_id", ticket.individualId)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= MAX_PROFILE_REQUESTS_PER_PERSON_PER_HOUR) {
    return NextResponse.json(
      { error: "Too many profile update requests. Please ask a leader for help." },
      { status: 429 }
    );
  }

  const { data: created, error: insertError } = await supabase
    .from("profile_update_requests")
    .insert({
      session_id: ticket.sessionId,
      ccb_individual_id: ticket.individualId,
      requested_email: input.email,
      requested_mobile_phone: input.mobilePhone,
      requested_home_phone: input.homePhone,
      ticket_jti: ticket.ticketId,
      status: "pending"
    })
    .select("id,status,created_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing } = await supabase
        .from("profile_update_requests")
        .select("id,status,created_at")
        .eq("ticket_jti", ticket.ticketId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          status: existing.status,
          message: "Your profile update request was already sent.",
          request: existing
        });
      }

      const { data: active } = await supabase
        .from("profile_update_requests")
        .select("id,status,created_at")
        .eq("ccb_individual_id", ticket.individualId)
        .in("status", ["pending", "processing"])
        .maybeSingle();

      if (active) {
        return NextResponse.json({
          status: active.status,
          message:
            "A profile update for this person is already waiting for administrator review.",
          request: active
        });
      }
    }

    return NextResponse.json(
      { error: "Could not send your profile update request. Please try again." },
      { status: 500 }
    );
  }

  await supabase.from("audit_logs").insert({
    actor_type: "public",
    actor_id: ticket.individualId,
    action: "profile_update_requested",
    target_type: "profile_update_requests",
    target_id: created.id,
    metadata_json: {
      session_id: ticket.sessionId,
      requested_fields: [
        input.email ? "email" : null,
        input.mobilePhone ? "mobile_phone" : null,
        input.homePhone ? "home_phone" : null
      ].filter(Boolean)
    }
  });

  return NextResponse.json({
    status: "pending",
    message:
      "Your update was sent to an administrator. Your CCB profile will be changed after review.",
    request: created
  });
}
