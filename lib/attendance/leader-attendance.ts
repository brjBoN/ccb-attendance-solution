import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type EnsureLeaderAttendanceInput = {
  sessionId: string;
  ccbGroupId: string;
  leaderIndividualId?: string | null;
};

export type LeaderAttendanceResult = {
  checkinId: string;
  ccbIndividualId: string;
  created: boolean;
} | null;

export async function ensureLeaderAttendanceForSession(
  input: EnsureLeaderAttendanceInput
): Promise<LeaderAttendanceResult> {
  const supabase = createSupabaseAdminClient();
  let leaderIndividualId = input.leaderIndividualId?.trim() || null;

  if (!leaderIndividualId) {
    const { data: mapping, error: mappingError } = await supabase
      .from("ccb_group_mappings")
      .select("ccb_main_leader_id")
      .eq("ccb_group_id", input.ccbGroupId)
      .is("deleted_at", null)
      .maybeSingle();

    if (mappingError) throw new Error(mappingError.message);
    leaderIndividualId = mapping?.ccb_main_leader_id?.trim() || null;
  }

  if (!leaderIndividualId) return null;

  const existing = await findLeaderCheckin(
    input.sessionId,
    leaderIndividualId
  );
  if (existing) {
    return {
      checkinId: existing.id,
      ccbIndividualId: leaderIndividualId,
      created: false
    };
  }

  const { data: checkin, error: insertError } = await supabase
    .from("attendance_checkins")
    .insert({
      session_id: input.sessionId,
      ccb_individual_id: leaderIndividualId,
      source: "admin",
      status: "success",
      ccb_sync_status: "not_synced",
      idempotency_key: `automatic-class-leader:${input.sessionId}`,
      metadata: {
        display_name: "Class leader",
        attendance_role: "leader",
        assumed_present: true,
        phase: "automatic_class_leader_attendance",
        ccb_group_id: input.ccbGroupId
      }
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const racedCheckin = await findLeaderCheckin(
        input.sessionId,
        leaderIndividualId
      );
      if (racedCheckin) {
        return {
          checkinId: racedCheckin.id,
          ccbIndividualId: leaderIndividualId,
          created: false
        };
      }
    }
    throw new Error(insertError.message);
  }

  await supabase.from("audit_logs").insert({
    actor_type: "system",
    action: "class_leader_assumed_present",
    target_type: "checkin_session",
    target_id: input.sessionId,
    metadata_json: {
      ccb_group_id: input.ccbGroupId,
      ccb_individual_id: leaderIndividualId
    }
  });

  return {
    checkinId: checkin.id,
    ccbIndividualId: leaderIndividualId,
    created: true
  };
}

async function findLeaderCheckin(
  sessionId: string,
  leaderIndividualId: string
) {
  const { data, error } = await createSupabaseAdminClient()
    .from("attendance_checkins")
    .select("id")
    .eq("session_id", sessionId)
    .eq("ccb_individual_id", leaderIndividualId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}
