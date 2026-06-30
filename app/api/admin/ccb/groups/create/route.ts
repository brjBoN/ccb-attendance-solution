import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGroupCreatorForApi } from "@/lib/auth/api";
import { isFullAdminRole } from "@/lib/auth/permissions";
import { ensureGroupSetupChecklist } from "@/lib/checklist/group-setup";
import { createCcbClient } from "@/lib/ccb/client";
import { CcbClientError } from "@/lib/ccb/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const groupSchema = z.object({
  name: z.string().trim().min(1).max(50),
  campusId: z.string().trim().min(1),
  mainLeaderId: z.string().trim().min(1),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  groupTypeId: z.string().optional().or(z.literal("")),
  departmentId: z.string().optional().or(z.literal("")),
  areaId: z.string().optional().or(z.literal("")),
  groupCapacity: z.string().optional().or(z.literal("")),
  meetingLocationStreetAddress: z.string().max(150).optional().or(z.literal("")),
  meetingLocationCity: z.string().max(50).optional().or(z.literal("")),
  meetingLocationState: z.string().max(5).optional().or(z.literal("")),
  meetingLocationZip: z.string().max(10).optional().or(z.literal("")),
  meetingDayId: z.string().optional().or(z.literal("")),
  meetingTimeId: z.string().optional().or(z.literal("")),
  childcareProvided: z.boolean().default(false),
  interactionType: z.enum(["Members Interact", "Announcement Only", "Administrative"]).default("Announcement Only"),
  membershipType: z.enum(["Open to All", "Invitation or Request Required"]).default("Invitation or Request Required"),
  listed: z.boolean().default(true),
  publicSearchListed: z.boolean().default(false),
  udfGroupPulldown1Id: z.string().optional().or(z.literal("")),
  udfGroupPulldown2Id: z.string().optional().or(z.literal("")),
  udfGroupPulldown3Id: z.string().optional().or(z.literal("")),
  localOnlyMetadata: z.record(z.unknown()).optional()
});

export async function POST(request: NextRequest) {
  const { admin, response } = await requireGroupCreatorForApi();
  if (response) return response;


  const body = await request.json().catch(() => null);
  const parsed = groupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid group creation payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;

  const validationError = validateCcbCreateGroupRules(input);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const apiPayload = {
    name: input.name,
    campusId: input.campusId,
    mainLeaderId: input.mainLeaderId,
    description: emptyToUndefined(input.description),
    groupTypeId: emptyToUndefined(input.groupTypeId),
    departmentId: emptyToUndefined(input.departmentId),
    areaId: emptyToUndefined(input.areaId),
    groupCapacity: emptyToUndefined(input.groupCapacity),
    meetingLocationStreetAddress: emptyToUndefined(input.meetingLocationStreetAddress),
    meetingLocationCity: emptyToUndefined(input.meetingLocationCity),
    meetingLocationState: emptyToUndefined(input.meetingLocationState)?.toUpperCase(),
    meetingLocationZip: emptyToUndefined(input.meetingLocationZip),
    meetingDayId: emptyToUndefined(input.meetingDayId),
    meetingTimeId: emptyToUndefined(input.meetingTimeId),
    childcareProvided: input.childcareProvided,
    interactionType: input.interactionType,
    membershipType: input.membershipType,
    listed: input.listed,
    publicSearchListed: input.publicSearchListed,
    udfGroupPulldown1Id: emptyToUndefined(input.udfGroupPulldown1Id),
    udfGroupPulldown2Id: emptyToUndefined(input.udfGroupPulldown2Id),
    udfGroupPulldown3Id: emptyToUndefined(input.udfGroupPulldown3Id)
  };

  const supabase = createSupabaseAdminClient();

  const [{ error: mappingSchemaError }, { error: checklistSchemaError }] = await Promise.all([
    supabase.from("ccb_group_mappings").select("id,ccb_main_leader_id").limit(1),
    supabase.from("ccb_group_setup_checklist").select("id").limit(1)
  ]);

  if (mappingSchemaError || checklistSchemaError) {
    return NextResponse.json(
      {
        error:
          "The permissions/checklist database migration has not been applied. Run supabase/migrations/0005_permissions_and_ccb_checklist.sql before creating another CCB group."
      },
      { status: 503 }
    );
  }

  try {
    const client = createCcbClient();
    const result = await client.createGroup(apiPayload);

    const ccbGroupId =
      typeof result === "object" && result && "id" in result
        ? String((result as { id: unknown }).id)
        : null;

    await supabase.from("ccb_group_create_logs").insert({
      ccb_group_id: ccbGroupId,
      group_name: input.name,
      created_by: admin?.id,
      request_payload: sanitizeForLog(input),
      api_payload: apiPayload,
      response_json: result,
      status: "created"
    });

    let mappingId: string | null = null;
    let checklistCreated = 0;

    if (ccbGroupId) {
      const { data: mapping, error: mappingError } = await supabase
        .from("ccb_group_mappings")
        .upsert(
          {
            ccb_group_id: ccbGroupId,
            group_name: input.name,
            ccb_main_leader_id: input.mainLeaderId,
            ccb_event_grouping_id: firstAttendanceGroupingId(input.localOnlyMetadata),
            auto_add_checkins_to_group: true,
            created_by_app: true,
            enabled: true,
            created_by: admin?.id,
            default_occurrence_rule: {
              created_by_app: true
            }
          },
          { onConflict: "ccb_group_id" }
        )
        .select("*")
        .single();

      if (mappingError) throw new Error(mappingError.message);
      mappingId = mapping.id;

      const checklist = await ensureGroupSetupChecklist(supabase, {
        groupMappingId: mapping.id,
        ccbGroupId,
        metadata: input.localOnlyMetadata ?? {}
      });
      checklistCreated = checklist.inserted;
    }

    await supabase.from("audit_logs").insert({
      actor_type: "admin",
      actor_id: admin?.id,
      action: "ccb_group_created",
      target_type: "ccb_group",
      target_id: ccbGroupId,
      metadata_json: {
        group_name: input.name
      }
    });

    return NextResponse.json({
      status: "created",
      ccbGroupId,
      mappingId,
      checklistCreated,
      checklistUrl: admin && isFullAdminRole(admin.role) ? "/admin/checklist" : null,
      group: result,
      message: ccbGroupId
        ? `Created CCB group ${input.name} with ID ${ccbGroupId}.`
        : `Created CCB group ${input.name}, but the group ID could not be read from the response.`
    });
  } catch (error) {
    const message =
      error instanceof CcbClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown CCB group creation error.";

    await supabase.from("ccb_group_create_logs").insert({
      group_name: input.name,
      created_by: admin?.id,
      request_payload: sanitizeForLog(input),
      api_payload: apiPayload,
      response_json: {},
      status: "failed",
      error_message: message
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function emptyToUndefined(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function validateCcbCreateGroupRules(input: z.infer<typeof groupSchema>) {
  if (input.interactionType === "Administrative" && input.membershipType === "Open to All") {
    return "CCB does not allow Administrative interaction type with Open to All membership type.";
  }

  if (input.interactionType === "Administrative" && input.listed) {
    return "CCB does not allow Administrative groups to be listed.";
  }

  if (input.interactionType === "Administrative" && input.publicSearchListed) {
    return "CCB does not allow Administrative groups to be public-search listed.";
  }

  if (input.membershipType === "Open to All" && !input.listed) {
    return "CCB does not allow Open to All membership type with Listed turned off.";
  }

  return null;
}

function sanitizeForLog(input: z.infer<typeof groupSchema>) {
  return {
    ...input,
    confirmCreate: undefined
  };
}


function firstAttendanceGroupingId(metadata: Record<string, unknown> | undefined) {
  const values = metadata?.attendanceGroupings;
  if (!Array.isArray(values)) return null;
  const first = values.map(String).find((value) => value.trim().length > 0);
  return first ?? null;
}
