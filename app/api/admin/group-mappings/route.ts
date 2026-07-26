import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForApi, requireGroupCreatorForApi } from "@/lib/auth/api";
import { isFullAdminRole } from "@/lib/auth/permissions";
import {
  findExistingGroupEvents,
  GroupEventDetectionUnavailableError,
  type ExistingGroupEvent
} from "@/lib/ccb/group-events";
import { CcbClientError } from "@/lib/ccb/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  ccbGroupId: z.string().regex(/^\d+$/),
  groupName: z.string().min(1),
  eventChoice: z.enum(["existing", "create_later"]),
  ccbEventId: z.string().regex(/^\d+$/).optional().nullable(),
  ccbEventGroupingId: z.string().regex(/^\d+$/).optional().nullable(),
  ccbMainLeaderId: z.string().optional().nullable(),
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
      message: "Choose a CCB Attendance Grouping for the new event."
    });
  }
  if (value.eventChoice === "create_later" && value.ccbEventId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ccbEventId"],
      message: "Do not include an event ID when creating the class event later."
    });
  }
});

export async function GET(request: NextRequest) {
  const { admin, response } = await requireAdminForApi();
  if (response || !admin) return response;

  const supabase = createSupabaseAdminClient();
  let query = supabase.from("ccb_group_mappings").select("*").is("deleted_at", null).order("group_name", { ascending: true });

  if (request.nextUrl.searchParams.get("scope") === "session" && !isFullAdminRole(admin.role)) {
    if (!admin.ccbIndividualId) return NextResponse.json({ results: [] });
    query = query.eq("ccb_main_leader_id", admin.ccbIndividualId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { admin, response } = await requireGroupCreatorForApi();
  if (response || !admin) return response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid group mapping payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  let groupProfile: {
    id: string;
    name: string | null;
    mainLeaderId: string | null;
  } | null;
  let attachedEvent: ExistingGroupEvent | null = null;
  try {
    const detection = await findExistingGroupEvents(parsed.data.ccbGroupId);
    groupProfile = detection?.group ?? null;
    if (parsed.data.eventChoice === "create_later") {
      if (detection?.events.length) {
        return NextResponse.json(
          {
            error:
              "CCB already has an attendance event for this class. Refresh and choose the existing event instead."
          },
          { status: 409 }
        );
      }
    } else {
      attachedEvent =
        detection?.events.find(
          (event) => event.id === parsed.data.ccbEventId
        ) ?? null;
      if (!attachedEvent) {
        return NextResponse.json(
          {
            error:
              "That event is not in this class’s current CCB calendar. Refresh and choose again."
          },
          { status: 409 }
        );
      }
    }
  } catch (error) {
    return ccbFailureResponse(error);
  }

  if (!groupProfile) {
    return NextResponse.json({ error: "CCB group not found." }, { status: 404 });
  }

  if (parsed.data.eventChoice === "existing") {
    if (!attachedEvent) {
      return NextResponse.json({ error: "The selected CCB event no longer exists." }, { status: 404 });
    }
    if (attachedEvent.groupId !== groupProfile.id) {
      return NextResponse.json(
        { error: "That CCB event belongs to a different class and cannot be attached." },
        { status: 409 }
      );
    }
  }

  const ccbEventId = attachedEvent?.id ?? null;
  const ccbEventGroupingId =
    attachedEvent?.eventGroupingId ??
    (parsed.data.eventChoice === "create_later"
      ? parsed.data.ccbEventGroupingId || null
      : null);
  const occurrenceTime = extractTime(attachedEvent?.startDateTime);
  const defaultOccurrenceRule = attachedEvent
    ? {
        source: "existing_ccb_event",
        timeZone: attachedEvent.timeZone ?? "America/New_York",
        ...(occurrenceTime ? { ccbOccurrenceTime: occurrenceTime } : {})
      }
    : {};

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ccb_group_mappings")
    .insert(
      {
        ccb_group_id: parsed.data.ccbGroupId,
        group_name: groupProfile.name ?? parsed.data.groupName,
        ccb_event_id: ccbEventId,
        ccb_event_grouping_id: ccbEventGroupingId,
        ccb_main_leader_id: groupProfile.mainLeaderId || parsed.data.ccbMainLeaderId,
        auto_add_checkins_to_group: parsed.data.autoAddCheckinsToGroup ?? true,
        created_by_app: false,
        enabled: parsed.data.enabled ?? true,
        created_by: admin.id,
        default_occurrence_rule: defaultOccurrenceRule
      }
    )
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This class is already enabled. Refresh the page before making changes." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_type: "admin",
    actor_id: admin.id,
    action: attachedEvent
      ? "existing_ccb_event_attached_to_group"
      : "group_enabled_for_qr_checkin",
    target_type: "ccb_group",
    target_id: groupProfile.id,
    metadata_json: {
      event_choice: parsed.data.eventChoice,
      ccb_event_id: ccbEventId,
      ccb_event_grouping_id: ccbEventGroupingId,
      schedule_model: "one_event_per_class"
    }
  });

  return NextResponse.json({
    mapping: data,
    attachedEvent: attachedEvent
      ? {
          id: attachedEvent.id,
          name: attachedEvent.name,
          startDateTime: attachedEvent.startDateTime,
          endDateTime: attachedEvent.endDateTime,
          recurrence: attachedEvent.recurrence,
          eventGroupingId: attachedEvent.eventGroupingId,
          eventGroupingName: attachedEvent.eventGroupingName
        }
      : null
  });
}

function extractTime(value: string | null | undefined) {
  const match = value?.match(/\b([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
  return match ? `${match[1]}:${match[2]}:${match[3] ?? "00"}` : null;
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
            : "CCB could not validate the class attendance event. Nothing was changed."
      },
      { status: error.status === 429 ? 503 : 502 }
    );
  }

  return NextResponse.json(
    { error: "CCB could not validate the class attendance event. Nothing was changed." },
    { status: 502 }
  );
}
