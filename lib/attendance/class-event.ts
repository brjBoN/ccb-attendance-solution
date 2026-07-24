import "server-only";

import { createCcbClient } from "@/lib/ccb/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { nextLocalOccurrence, normalizeTime } from "@/lib/time/zoned";

export const DEFAULT_CLASS_TIME_ZONE = "America/New_York";

type ClassMapping = {
  id: string;
  ccb_group_id: string;
  group_name: string;
  ccb_event_id: string | null;
  ccb_event_grouping_id: string | null;
  default_occurrence_rule: unknown;
};

type MeetingAnchor = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timeZone?: string;
};

export async function ensureClassAttendanceEvent(
  mapping: ClassMapping,
  anchor: MeetingAnchor,
  actorId?: string | null
) {
  const timeZone = anchor.timeZone ?? DEFAULT_CLASS_TIME_ZONE;
  const existingRule = asObject(mapping.default_occurrence_rule);
  let ccbOccurrenceTime = readTime(existingRule.ccbOccurrenceTime);

  if (mapping.ccb_event_id) {
    if (!ccbOccurrenceTime) {
      const event = await createCcbClient().getEventProfile({
        eventId: mapping.ccb_event_id
      });
      ccbOccurrenceTime =
        extractTime(event?.startDateTime) ?? normalizeTime(anchor.startTime);
      await saveOccurrenceRule(mapping.id, existingRule, {
        ccbOccurrenceTime,
        timeZone,
        source: "existing_ccb_event"
      });
    }

    return {
      ccbEventId: mapping.ccb_event_id,
      ccbOccurrenceTime,
      created: false
    };
  }

  if (!mapping.ccb_event_grouping_id) {
    throw new Error(
      "This class needs a CCB Attendance Grouping before its schedule can be saved. Ask an administrator to set it on the Classes page."
    );
  }

  const next = nextLocalOccurrence({
    ...anchor,
    timeZone
  });
  const event = await createCcbClient().createEvent({
    groupId: mapping.ccb_group_id,
    startDate: next.startDateTime,
    endDate: next.endDateTime,
    name: `${mapping.group_name} Attendance`,
    description:
      "Attendance event managed by the Heritage Church class check-in app.",
    eventGroupingId: mapping.ccb_event_grouping_id,
    recurrenceType: "daily",
    recurrenceFrequency: 1,
    listed: false,
    attendanceReminder: false,
    notification: false,
    usesResources: false,
    useCampusAddress: false
  });
  const ccbEventId = readId(event);

  if (!ccbEventId) {
    throw new Error(
      "CCB created the attendance event, but its event ID was not returned."
    );
  }

  ccbOccurrenceTime = normalizeTime(anchor.startTime);
  const nextRule = {
    ...existingRule,
    ccbOccurrenceTime,
    timeZone,
    source: "heritage_class_schedule",
    recurrenceType: "daily"
  };
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("ccb_group_mappings")
    .update({
      ccb_event_id: ccbEventId,
      default_occurrence_rule: nextRule
    })
    .eq("id", mapping.id);
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_type: "admin",
    actor_id: actorId ?? null,
    action: "class_attendance_event_created",
    target_type: "ccb_event",
    target_id: ccbEventId,
    metadata_json: {
      group_id: mapping.ccb_group_id,
      group_name: mapping.group_name,
      event_grouping_id: mapping.ccb_event_grouping_id,
      schedule_model: "one_event_per_class"
    }
  });

  return { ccbEventId, ccbOccurrenceTime, created: true };
}

export function ccbOccurrenceForDate(
  localDate: string,
  ccbOccurrenceTime: string
) {
  return `${localDate} ${normalizeTime(ccbOccurrenceTime)}`;
}

async function saveOccurrenceRule(
  mappingId: string,
  current: Record<string, unknown>,
  patch: Record<string, unknown>
) {
  const { error } = await createSupabaseAdminClient()
    .from("ccb_group_mappings")
    .update({ default_occurrence_rule: { ...current, ...patch } })
    .eq("id", mappingId);
  if (error) throw new Error(error.message);
}

function extractTime(value: string | null | undefined) {
  const match = value?.match(/\b([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
  return match ? `${match[1]}:${match[2]}:${match[3] ?? "00"}` : null;
}

function readTime(value: unknown) {
  return typeof value === "string" ? extractTime(value) : null;
}

function readId(value: unknown) {
  return value && typeof value === "object" && "id" in value
    ? String((value as { id: unknown }).id)
    : "";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
