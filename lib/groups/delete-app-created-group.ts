import "server-only";

import { createCcbClient } from "@/lib/ccb/client";
import { CcbClientError } from "@/lib/ccb/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DeleteEventResult = {
  eventId: string;
  status: "deleted" | "failed" | "unsupported" | "skipped";
  message: string;
};

type LocalDeleteSummary = {
  pendingPeople: number;
  attendanceCheckins: number;
  personSearchLogs: number;
  sessions: number;
  tokens: number;
  checklistItems: number;
};

export type DeleteAppCreatedGroupResult = {
  ok: true;
  ccbGroupId: string;
  groupName: string;
  ccbGroupDeleteStatus: "deleted" | "inactivated";
  ccbGroupDeleteMessage: string;
  ccbEventDeleteResults: DeleteEventResult[];
  localDeleteSummary: LocalDeleteSummary;
};

export async function deleteAppCreatedGroup(input: {
  mappingId: string;
  requestedByAdminId: string;
  confirmationText: string;
}): Promise<DeleteAppCreatedGroupResult> {
  const supabase = createSupabaseAdminClient();

  const { data: mapping, error: mappingError } = await supabase
    .from("ccb_group_mappings")
    .select("*")
    .eq("id", input.mappingId)
    .maybeSingle();

  if (mappingError) throw new Error(mappingError.message);
  if (!mapping) throw new Error("Group mapping not found.");
  if (mapping.deleted_at) throw new Error("This group mapping has already been deleted/archived from the app.");

  const expectedConfirmation = `DELETE ${mapping.group_name}`;
  if (input.confirmationText !== expectedConfirmation) {
    throw new Error(`Type exactly ${expectedConfirmation} to confirm deletion.`);
  }

  const { data: createLog } = await supabase
    .from("ccb_group_create_logs")
    .select("id,ccb_group_id,status,created_at")
    .eq("ccb_group_id", mapping.ccb_group_id)
    .eq("status", "created")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const createdByApp = Boolean(mapping.created_by_app || createLog);
  if (!createdByApp) {
    throw new Error(
      "This CCB group was not created through the app, so the app is not allowed to delete or inactivate it. Remove only the local mapping if needed."
    );
  }

  const client = createCcbClient();
  const { data: sessions, error: sessionsError } = await supabase
    .from("checkin_sessions")
    .select("id,ccb_event_id,options")
    .eq("ccb_group_id", mapping.ccb_group_id);

  if (sessionsError) throw new Error(sessionsError.message);

  const appCreatedEventIds = new Set<string>();
  for (const session of sessions ?? []) {
    const options = session.options as Record<string, unknown> | null;
    if (options?.event_created_by_app && session.ccb_event_id) {
      appCreatedEventIds.add(String(session.ccb_event_id));
    }
  }

  const ccbEventDeleteResults: DeleteEventResult[] = [];
  for (const eventId of appCreatedEventIds) {
    try {
      await client.deleteEventIfServiceExists({ eventId });
      ccbEventDeleteResults.push({
        eventId,
        status: "deleted",
        message: "CCB accepted delete_event for this app-created event."
      });
    } catch (error) {
      const message = errorMessage(error);
      ccbEventDeleteResults.push({
        eventId,
        status: isUnsupportedDeleteMessage(message) ? "unsupported" : "failed",
        message
      });
    }
  }

  let ccbGroupDeleteStatus: "deleted" | "inactivated";
  let ccbGroupDeleteMessage: string;

  try {
    await client.deleteGroupIfServiceExists({ groupId: mapping.ccb_group_id });
    ccbGroupDeleteStatus = "deleted";
    ccbGroupDeleteMessage = "CCB accepted delete_group for this app-created group.";
  } catch (deleteError) {
    const deleteMessage = errorMessage(deleteError);
    try {
      await client.inactivateGroup({ groupId: mapping.ccb_group_id });
      ccbGroupDeleteStatus = "inactivated";
      ccbGroupDeleteMessage = `CCB delete_group failed or is unsupported, so the app marked the app-created group inactive with update_group. delete_group response: ${deleteMessage}`;
    } catch (inactivateError) {
      const inactivateMessage = errorMessage(inactivateError);
      await supabase.from("ccb_group_deletion_logs").insert({
        group_mapping_id: mapping.id,
        ccb_group_id: mapping.ccb_group_id,
        group_name: mapping.group_name,
        requested_by: input.requestedByAdminId,
        confirmation_text: input.confirmationText,
        ccb_group_delete_attempted: true,
        ccb_group_delete_status: "failed",
        ccb_group_delete_message: `delete_group failed: ${deleteMessage}; update_group inactive failed: ${inactivateMessage}`,
        ccb_event_delete_results: ccbEventDeleteResults,
        local_delete_summary: {}
      });
      throw new Error(
        `Could not delete or inactivate the CCB group, so local data was not removed. delete_group: ${deleteMessage}; update_group inactive: ${inactivateMessage}`
      );
    }
  }

  const sessionIds = (sessions ?? []).map((session) => session.id as string);
  const localDeleteSummary = await deleteLocalGroupData({
    mappingId: mapping.id,
    sessionIds,
    requestedByAdminId: input.requestedByAdminId,
    ccbGroupDeleteStatus,
    ccbGroupDeleteMessage
  });

  await supabase.from("ccb_group_deletion_logs").insert({
    group_mapping_id: mapping.id,
    ccb_group_id: mapping.ccb_group_id,
    group_name: mapping.group_name,
    requested_by: input.requestedByAdminId,
    confirmation_text: input.confirmationText,
    ccb_group_delete_attempted: true,
    ccb_group_delete_status: ccbGroupDeleteStatus,
    ccb_group_delete_message: ccbGroupDeleteMessage,
    ccb_event_delete_results: ccbEventDeleteResults,
    local_delete_summary: localDeleteSummary
  });

  await supabase.from("audit_logs").insert({
    actor_type: "admin",
    actor_id: input.requestedByAdminId,
    action: "app_created_group_deleted_or_inactivated",
    target_type: "ccb_group",
    target_id: mapping.ccb_group_id,
    metadata_json: {
      group_mapping_id: mapping.id,
      group_name: mapping.group_name,
      ccb_group_delete_status: ccbGroupDeleteStatus,
      ccb_event_delete_results: ccbEventDeleteResults,
      local_delete_summary: localDeleteSummary
    }
  });

  return {
    ok: true,
    ccbGroupId: mapping.ccb_group_id,
    groupName: mapping.group_name,
    ccbGroupDeleteStatus,
    ccbGroupDeleteMessage,
    ccbEventDeleteResults,
    localDeleteSummary
  };
}

async function deleteLocalGroupData(input: {
  mappingId: string;
  sessionIds: string[];
  requestedByAdminId: string;
  ccbGroupDeleteStatus: string;
  ccbGroupDeleteMessage: string;
}): Promise<LocalDeleteSummary> {
  const supabase = createSupabaseAdminClient();
  const summary: LocalDeleteSummary = {
    pendingPeople: 0,
    attendanceCheckins: 0,
    personSearchLogs: 0,
    sessions: 0,
    tokens: 0,
    checklistItems: 0
  };

  if (input.sessionIds.length) {
    const { count: tokenCount } = await supabase
      .from("checkin_tokens")
      .select("*", { count: "exact", head: true })
      .in("session_id", input.sessionIds);
    summary.tokens = tokenCount ?? 0;

    const { count: pendingCount } = await supabase
      .from("pending_people")
      .select("*", { count: "exact", head: true })
      .in("session_id", input.sessionIds);
    summary.pendingPeople = pendingCount ?? 0;

    const { count: checkinCount } = await supabase
      .from("attendance_checkins")
      .select("*", { count: "exact", head: true })
      .in("session_id", input.sessionIds);
    summary.attendanceCheckins = checkinCount ?? 0;

    const { count: searchCount } = await supabase
      .from("person_search_logs")
      .select("*", { count: "exact", head: true })
      .in("session_id", input.sessionIds);
    summary.personSearchLogs = searchCount ?? 0;

    await supabase.from("pending_people").delete().in("session_id", input.sessionIds);
    await supabase.from("attendance_checkins").delete().in("session_id", input.sessionIds);
    await supabase.from("person_search_logs").delete().in("session_id", input.sessionIds);
    const { count: sessionCount } = await supabase
      .from("checkin_sessions")
      .select("*", { count: "exact", head: true })
      .in("id", input.sessionIds);
    summary.sessions = sessionCount ?? 0;
    await supabase.from("checkin_sessions").delete().in("id", input.sessionIds);
  }

  const { count: checklistCount } = await supabase
    .from("ccb_group_setup_checklist")
    .select("*", { count: "exact", head: true })
    .eq("group_mapping_id", input.mappingId);
  summary.checklistItems = checklistCount ?? 0;
  await supabase.from("ccb_group_setup_checklist").delete().eq("group_mapping_id", input.mappingId);

  await supabase
    .from("ccb_group_mappings")
    .update({
      enabled: false,
      deleted_at: new Date().toISOString(),
      deleted_by: input.requestedByAdminId,
      ccb_delete_status: input.ccbGroupDeleteStatus,
      ccb_delete_message: input.ccbGroupDeleteMessage
    })
    .eq("id", input.mappingId);

  return summary;
}

function errorMessage(error: unknown) {
  if (error instanceof CcbClientError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

function isUnsupportedDeleteMessage(message: string) {
  return /service|permission|not found|unknown|invalid/i.test(message);
}
