import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGroupCreatorForApi } from "@/lib/auth/api";
import { createCcbClient } from "@/lib/ccb/client";
import { CcbClientError } from "@/lib/ccb/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  campusId: z.string().trim().min(1),
  description: z.string().trim().max(4000),
  groupTypeId: z.string(),
  departmentId: z.string(),
  areaId: z.string(),
  groupCapacity: z.string(),
  meetingLocationStreetAddress: z.string().max(150),
  meetingLocationCity: z.string().max(50),
  meetingLocationState: z.string().max(5),
  meetingLocationZip: z.string().max(10),
  meetingDayId: z.string(),
  meetingTimeId: z.string(),
  childcareProvided: z.boolean(),
  interactionType: z.enum(["Members Interact", "Announcement Only", "Administrative"]),
  membershipType: z.enum([
    "Open to All",
    "Invitation or Request Required",
    "Invitation Required",
    "Request Required"
  ]),
  notification: z.boolean(),
  listed: z.boolean(),
  publicSearchListed: z.boolean(),
  udfGroupPulldown1Id: z.string(),
  udfGroupPulldown2Id: z.string(),
  udfGroupPulldown3Id: z.string()
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { response } = await requireGroupCreatorForApi();
  if (response) return response;

  const { groupId } = await params;

  try {
    const group = await createCcbClient().getGroupProfile({ groupId });
    if (!group) return NextResponse.json({ error: "CCB group not found." }, { status: 404 });
    const { raw: _raw, ...serializableGroup } = group;
    return NextResponse.json({ group: serializableGroup });
  } catch (error) {
    return NextResponse.json(formatCcbError(error), { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { admin, response } = await requireGroupCreatorForApi();
  if (response) return response;

  const { groupId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid group update payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ruleError = validateGroupRules(parsed.data);
  if (ruleError) return NextResponse.json({ error: ruleError }, { status: 400 });

  try {
    const group = await createCcbClient().updateGroup({
      id: groupId,
      ...parsed.data,
      meetingLocationState: parsed.data.meetingLocationState.toUpperCase()
    });

    const supabase = createSupabaseAdminClient();
    await supabase
      .from("ccb_group_mappings")
      .update({ group_name: parsed.data.name })
      .eq("ccb_group_id", groupId);

    await supabase.from("audit_logs").insert({
      actor_type: "admin",
      actor_id: admin?.id,
      action: "ccb_group_updated",
      target_type: "ccb_group",
      target_id: groupId,
      metadata_json: { group_name: parsed.data.name }
    });

    return NextResponse.json({
      status: "updated",
      message: `Updated ${parsed.data.name} in CCB.`,
      group
    });
  } catch (error) {
    return NextResponse.json(formatCcbError(error), { status: 500 });
  }
}

function validateGroupRules(input: z.infer<typeof updateSchema>) {
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

function formatCcbError(error: unknown) {
  if (error instanceof CcbClientError) {
    return { error: error.message, service: error.service, status: error.status };
  }
  return { error: error instanceof Error ? error.message : "Unknown CCB group update error." };
}
