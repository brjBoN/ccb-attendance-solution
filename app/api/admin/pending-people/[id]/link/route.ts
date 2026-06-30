import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { requireFullAdminForApi } from "@/lib/auth/api";
import { createCcbClient } from "@/lib/ccb/client";
import { syncAttendanceCheckin } from "@/lib/attendance/sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  ccbIndividualId: z.string().trim().min(1),
  submitAttendance: z.boolean().default(true)
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, response } = await requireFullAdminForApi();
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid link payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: pending, error: pendingError } = await supabase
    .from("pending_people")
    .select(
      `
      *,
      checkin_sessions (
        id,
        ccb_group_id,
        ccb_event_id,
        occurrence_date
      )
    `
    )
    .eq("id", id)
    .single();

  if (pendingError || !pending) {
    return NextResponse.json(
      { error: pendingError?.message ?? "Pending guest not found." },
      { status: 404 }
    );
  }

  const session = Array.isArray(pending.checkin_sessions)
    ? pending.checkin_sessions[0]
    : pending.checkin_sessions;

  let groupAddWarning: string | null = null;
  if (session?.ccb_group_id) {
    try {
      await createCcbClient().addIndividualToGroup({
        individualId: parsed.data.ccbIndividualId,
        groupId: session.ccb_group_id,
        status: "add"
      });
    } catch (error) {
      groupAddWarning = error instanceof Error ? error.message : "Could not add the person to the CCB group.";
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("pending_people")
    .update({
      status: "linked",
      linked_ccb_individual_id: parsed.data.ccbIndividualId,
      reviewed_by: admin?.id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  let syncResult = null;
  if (parsed.data.submitAttendance && pending.session_id) {
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`${pending.session_id}:${parsed.data.ccbIndividualId}:guest-link`)
      .digest("hex");

    const { data: existing } = await supabase
      .from("attendance_checkins")
      .select("id")
      .eq("session_id", pending.session_id)
      .eq("ccb_individual_id", parsed.data.ccbIndividualId)
      .maybeSingle();

    let checkinId = existing?.id;
    if (!checkinId) {
      const { data: checkin, error: checkinError } = await supabase
        .from("attendance_checkins")
        .insert({
          session_id: pending.session_id,
          ccb_individual_id: parsed.data.ccbIndividualId,
          source: "guest_approval",
          status: "success",
          ccb_sync_status: "not_synced",
          idempotency_key: idempotencyKey,
          metadata: {
            pending_person_id: id,
            display_name: `${pending.first_name} ${pending.last_name}`
          }
        })
        .select("id")
        .single();

      if (checkinError) return NextResponse.json({ error: checkinError.message }, { status: 500 });
      checkinId = checkin.id;
    }

    syncResult = await syncAttendanceCheckin(checkinId);
  }

  await supabase.from("audit_logs").insert({
    actor_type: "admin",
    actor_id: admin?.id,
    action: "pending_guest_linked",
    target_type: "pending_people",
    target_id: id,
    metadata_json: {
      linked_ccb_individual_id: parsed.data.ccbIndividualId,
      ccb_group_add_attempted: Boolean(session?.ccb_group_id),
      group_add_warning: groupAddWarning,
      sync_result: syncResult
    }
  });

  return NextResponse.json({ pendingPerson: updated, groupAddWarning, syncResult });
}
