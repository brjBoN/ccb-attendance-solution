import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireFullAdminForApi } from "@/lib/auth/api";
import { createCcbClient } from "@/lib/ccb/client";
import { normalizeIndividuals } from "@/lib/ccb/normalizers";
import { CcbClientError } from "@/lib/ccb/types";
import { syncAttendanceCheckin } from "@/lib/attendance/sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, response } = await requireFullAdminForApi();
  if (response) return response;

  const { id } = await params;
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

  try {
    const client = createCcbClient();
    const duplicateCandidates = await client.searchIndividuals({
      firstName: pending.first_name,
      lastName: pending.last_name,
      phone: pending.phone ?? undefined,
      email: pending.email ?? undefined
    });

    if (duplicateCandidates.length > 0) {
      return NextResponse.json(
        {
          error: "Possible duplicate CCB profiles were found. Link this guest to an existing person instead.",
          duplicateCount: duplicateCandidates.length
        },
        { status: 409 }
      );
    }

    const created = await client.createIndividual({
      firstName: pending.first_name,
      lastName: pending.last_name,
      email: pending.email ?? undefined,
      mobilePhone: pending.phone ?? undefined,
      familyPosition: "o"
    });

    const createdId =
      typeof created === "object" && created && "id" in created
        ? String((created as { id: unknown }).id)
        : normalizeIndividuals(created)[0]?.id;

    if (!createdId) {
      return NextResponse.json(
        { error: "CCB person was created, but the created individual ID could not be read." },
        { status: 500 }
      );
    }

    const session = Array.isArray(pending.checkin_sessions)
      ? pending.checkin_sessions[0]
      : pending.checkin_sessions;

    let groupAddWarning: string | null = null;
    if (session?.ccb_group_id) {
      try {
        await client.addIndividualToGroup({
          individualId: createdId,
          groupId: session.ccb_group_id,
          status: "add"
        });
      } catch (error) {
        groupAddWarning =
          error instanceof Error ? error.message : "Could not add the created person to the CCB group.";
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("pending_people")
      .update({
        status: "approved",
        created_ccb_individual_id: createdId,
        reviewed_by: admin?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    let syncResult = null;
    if (pending.session_id) {
      const idempotencyKey = crypto
        .createHash("sha256")
        .update(`${pending.session_id}:${createdId}:guest-created`)
        .digest("hex");

      const { data: existing } = await supabase
        .from("attendance_checkins")
        .select("id")
        .eq("session_id", pending.session_id)
        .eq("ccb_individual_id", createdId)
        .maybeSingle();

      let checkinId = existing?.id;
      if (!checkinId) {
        const { data: checkin, error: checkinError } = await supabase
          .from("attendance_checkins")
          .insert({
            session_id: pending.session_id,
            ccb_individual_id: createdId,
            source: "guest_approval",
            status: "success",
            ccb_sync_status: "not_synced",
            idempotency_key: idempotencyKey,
            metadata: {
              pending_person_id: id,
              created_person: true,
              display_name: `${pending.first_name} ${pending.last_name}`
            }
          })
          .select("id")
          .single();

        if (checkinError) {
          return NextResponse.json({ error: checkinError.message }, { status: 500 });
        }
        checkinId = checkin.id;
      }

      syncResult = await syncAttendanceCheckin(checkinId);
    }

    await supabase.from("audit_logs").insert({
      actor_type: "admin",
      actor_id: admin?.id,
      action: "pending_guest_approved_created",
      target_type: "pending_people",
      target_id: id,
      metadata_json: {
        created_ccb_individual_id: createdId,
        ccb_group_add_attempted: Boolean(session?.ccb_group_id),
        group_add_warning: groupAddWarning,
        sync_result: syncResult
      }
    });

    return NextResponse.json({
      pendingPerson: updated,
      createdCcbIndividualId: createdId,
      groupAddWarning,
      syncResult
    });
  } catch (error) {
    const message =
      error instanceof CcbClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown CCB person creation error.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
