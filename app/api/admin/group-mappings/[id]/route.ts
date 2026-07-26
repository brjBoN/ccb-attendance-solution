import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGroupCreatorForApi } from "@/lib/auth/api";
import {
  findExistingGroupEvents,
  GroupEventDetectionUnavailableError
} from "@/lib/ccb/group-events";
import { CcbClientError } from "@/lib/ccb/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  groupName: z.string().min(1).optional(),
  eventChoice: z.enum(["existing", "create_later"]).optional(),
  ccbEventId: z.string().regex(/^\d+$/).optional().nullable(),
  ccbEventGroupingId: z.string().regex(/^\d+$/).optional().nullable(),
  autoAddCheckinsToGroup: z.boolean().optional(),
  enabled: z.boolean().optional()
}).superRefine((value, context) => {
  if (value.eventChoice === "existing" && !value.ccbEventId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ccbEventId"],
      message: "Choose an existing CCB attendance event."
    });
  }
  if (value.eventChoice === "create_later" && !value.ccbEventGroupingId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ccbEventGroupingId"],
      message: "Choose a CCB Attendance Grouping."
    });
  }
  if (value.eventChoice === "create_later" && value.ccbEventId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ccbEventId"],
      message: "Do not include an event ID when creating the group event later."
    });
  }
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireGroupCreatorForApi();
  if (response || !admin) return response;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: current, error: readError } = await supabase
    .from("ccb_group_mappings")
    .select("id,ccb_group_id,ccb_event_id,default_occurrence_rule")
    .eq("id", id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Group mapping not found." }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (parsed.data.groupName !== undefined) update.group_name = parsed.data.groupName;
  if (parsed.data.eventChoice === "create_later") {
    if (current.ccb_event_id) {
      return NextResponse.json(
        { error: "This group is already connected to a CCB attendance event." },
        { status: 409 }
      );
    }

    try {
      const detection = await findExistingGroupEvents(current.ccb_group_id);
      if (detection?.events.length) {
        return NextResponse.json(
          {
            error:
              "CCB already has an attendance event for this group. Refresh and choose the existing event instead."
          },
          { status: 409 }
        );
      }
    } catch (error) {
      return ccbFailureResponse(error);
    }
    update.ccb_event_grouping_id = parsed.data.ccbEventGroupingId;
    update.default_occurrence_rule = {};
  }

  if (
    parsed.data.ccbEventId !== undefined &&
    parsed.data.ccbEventId !== current.ccb_event_id
  ) {
    if (!parsed.data.ccbEventId) {
      return NextResponse.json(
        { error: "A linked CCB event cannot be removed from the general group update." },
        { status: 400 }
      );
    }

    let event;
    try {
      const detection = await findExistingGroupEvents(current.ccb_group_id);
      event =
        detection?.events.find(
          (candidate) => candidate.id === parsed.data.ccbEventId
        ) ?? null;
    } catch (error) {
      return ccbFailureResponse(error);
    }
    if (!event) {
      return NextResponse.json(
        {
          error:
            "That event is not in this group’s current CCB calendar. Refresh and choose again."
        },
        { status: 409 }
      );
    }
    if (event.groupId !== current.ccb_group_id) {
      return NextResponse.json(
        { error: "That CCB event belongs to a different group and cannot be attached." },
        { status: 409 }
      );
    }

    const existingRule = asObject(current.default_occurrence_rule);
    delete existingRule.ccbOccurrenceTime;
    delete existingRule.eventProvisioningStartedAt;
    const occurrenceTime = extractTime(event.startDateTime);
    update.ccb_event_id = event.id;
    update.ccb_event_grouping_id = event.eventGroupingId;
    update.default_occurrence_rule = {
      ...existingRule,
      source: "existing_ccb_event",
      timeZone: event.timeZone ?? "America/New_York",
      ...(occurrenceTime ? { ccbOccurrenceTime: occurrenceTime } : {})
    };
  }
  if (
    parsed.data.ccbEventGroupingId !== undefined &&
    !update.ccb_event_id
  ) {
    update.ccb_event_grouping_id = parsed.data.ccbEventGroupingId || null;
  }
  if (parsed.data.autoAddCheckinsToGroup !== undefined) update.auto_add_checkins_to_group = parsed.data.autoAddCheckinsToGroup;
  if (parsed.data.enabled !== undefined) update.enabled = parsed.data.enabled;

  const { data, error } = await supabase.from("ccb_group_mappings").update(update).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (update.ccb_event_id) {
    await supabase.from("audit_logs").insert({
      actor_type: "admin",
      actor_id: admin.id,
      action: "existing_ccb_event_attached_to_group",
      target_type: "ccb_group",
      target_id: current.ccb_group_id,
      metadata_json: {
        ccb_event_id: update.ccb_event_id,
        schedule_model: "one_event_per_class"
      }
    });
  }

  return NextResponse.json({ mapping: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireGroupCreatorForApi();
  if (response) return response;

  if (request.headers.get("x-confirm-delete") !== "confirmed") {
    return NextResponse.json({ error: "Deletion requires explicit confirmation." }, { status: 409 });
  }

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: mapping, error: readError } = await supabase
    .from("ccb_group_mappings")
    .select("id,group_name,created_by_app,deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!mapping) return NextResponse.json({ error: "Group mapping not found." }, { status: 404 });

  if (mapping.created_by_app) {
    return NextResponse.json(
      { error: "This group was created by the app. Use the protected app-created group deletion action instead of deleting only the local mapping." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("ccb_group_mappings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function extractTime(value: string | null | undefined) {
  const match = value?.match(/\b([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
  return match ? `${match[1]}:${match[2]}:${match[3] ?? "00"}` : null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function ccbFailureResponse(error: unknown) {
  if (error instanceof GroupEventDetectionUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof CcbClientError) {
    return NextResponse.json(
      {
        error:
          error.status === 429
            ? "CCB is temporarily limiting requests. Nothing was changed; please try again in a minute."
            : "CCB could not validate the group attendance event. Nothing was changed."
      },
      { status: error.status === 429 ? 503 : 502 }
    );
  }
  return NextResponse.json(
    { error: "CCB could not validate the group attendance event. Nothing was changed." },
    { status: 502 }
  );
}
