import "server-only";

import { createCcbClient } from "@/lib/ccb/client";
import { findExistingGroupEvents } from "@/lib/ccb/group-events";
import { CcbClientError } from "@/lib/ccb/types";
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

  const existingProvisioningStartedAt = readString(
    existingRule.eventProvisioningStartedAt
  );
  if (existingProvisioningStartedAt) {
    const recovered = await recoverProvisionedEvent(
      mapping,
      existingRule,
      existingProvisioningStartedAt,
      actorId
    );
    if (recovered) return recovered;
    if (leaseIsStale(existingProvisioningStartedAt)) {
      const clearedRule = { ...existingRule };
      delete clearedRule.eventProvisioningStartedAt;
      await clearEventProvisioning(
        mapping.id,
        existingProvisioningStartedAt,
        clearedRule
      );
      return ensureClassAttendanceEvent(
        { ...mapping, default_occurrence_rule: clearedRule },
        anchor,
        actorId
      );
    }
    throw new Error(
      "A previous CCB event setup may still be finishing. No second event was created. Wait a minute, then save the schedule again."
    );
  }

  const detected = await findExistingGroupEvents(mapping.ccb_group_id);
  if (!detected) {
    throw new Error("The CCB class could not be verified. No attendance event was created.");
  }
  if (detected.events.length) {
    throw new Error(
      "CCB already has an attendance event for this class. No duplicate was created. Connect the existing event from the Classes page first."
    );
  }

  const provisioningStartedAt = new Date().toISOString();
  await claimEventProvisioning(
    mapping.id,
    existingRule,
    provisioningStartedAt
  );

  const next = nextLocalOccurrence({
    ...anchor,
    timeZone
  });
  let event: unknown;
  try {
    event = await createCcbClient().createEvent({
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
  } catch (error) {
    if (
      error instanceof CcbClientError &&
      error.status &&
      error.status >= 400 &&
      error.status < 500
    ) {
      await clearEventProvisioning(
        mapping.id,
        provisioningStartedAt,
        existingRule
      );
    }
    throw error;
  }
  const ccbEventId = readId(event);

  if (!ccbEventId) {
    throw new Error(
      "CCB created the attendance event, but its event ID was not returned."
    );
  }

  ccbOccurrenceTime = normalizeTime(anchor.startTime);
  const ruleWithoutProvisioning = { ...existingRule };
  delete ruleWithoutProvisioning.eventProvisioningStartedAt;
  const nextRule = {
    ...ruleWithoutProvisioning,
    ccbOccurrenceTime,
    timeZone,
    source: "heritage_class_schedule",
    recurrenceType: "daily"
  };
  const supabase = createSupabaseAdminClient();
  const { data: updatedMapping, error } = await supabase
    .from("ccb_group_mappings")
    .update({
      ccb_event_id: ccbEventId,
      default_occurrence_rule: nextRule
    })
    .eq("id", mapping.id)
    .eq(
      "default_occurrence_rule->>eventProvisioningStartedAt",
      provisioningStartedAt
    )
    .is("ccb_event_id", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updatedMapping) {
    throw new Error(
      "CCB created the event, but the class changed before it could be connected. No retry was attempted."
    );
  }

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

async function claimEventProvisioning(
  mappingId: string,
  current: Record<string, unknown>,
  provisioningStartedAt: string
) {
  const { data, error } = await createSupabaseAdminClient()
    .from("ccb_group_mappings")
    .update({
      default_occurrence_rule: {
        ...current,
        source: "event_provisioning",
        eventProvisioningStartedAt: provisioningStartedAt
      }
    })
    .eq("id", mappingId)
    .is("ccb_event_id", null)
    .is("default_occurrence_rule->>eventProvisioningStartedAt", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "Another attendance event setup is already in progress. No second event was created."
    );
  }
}

async function clearEventProvisioning(
  mappingId: string,
  provisioningStartedAt: string,
  nextRule: Record<string, unknown>
) {
  const { error } = await createSupabaseAdminClient()
    .from("ccb_group_mappings")
    .update({ default_occurrence_rule: nextRule })
    .eq("id", mappingId)
    .eq(
      "default_occurrence_rule->>eventProvisioningStartedAt",
      provisioningStartedAt
    )
    .is("ccb_event_id", null);
  if (error) throw new Error(error.message);
}

async function recoverProvisionedEvent(
  mapping: ClassMapping,
  existingRule: Record<string, unknown>,
  provisioningStartedAt: string,
  actorId?: string | null
) {
  const detection = await findExistingGroupEvents(mapping.ccb_group_id);
  const expectedName = `${mapping.group_name} Attendance`;
  const matchingEvents =
    detection?.events.filter((event) => event.name === expectedName) ?? [];
  if (matchingEvents.length !== 1) return null;

  const event = matchingEvents[0];
  const ccbOccurrenceTime =
    extractTime(event.startDateTime) ??
    readTime(existingRule.ccbOccurrenceTime);
  if (!ccbOccurrenceTime) return null;

  const ruleWithoutProvisioning = { ...existingRule };
  delete ruleWithoutProvisioning.eventProvisioningStartedAt;
  const nextRule = {
    ...ruleWithoutProvisioning,
    ccbOccurrenceTime,
    timeZone: event.timeZone ?? DEFAULT_CLASS_TIME_ZONE,
    source: "heritage_class_schedule",
    recurrenceType: "daily"
  };
  const supabase = createSupabaseAdminClient();
  const { data: updatedMapping, error } = await supabase
    .from("ccb_group_mappings")
    .update({
      ccb_event_id: event.id,
      ccb_event_grouping_id:
        event.eventGroupingId ?? mapping.ccb_event_grouping_id,
      default_occurrence_rule: nextRule
    })
    .eq("id", mapping.id)
    .eq(
      "default_occurrence_rule->>eventProvisioningStartedAt",
      provisioningStartedAt
    )
    .is("ccb_event_id", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updatedMapping) return null;

  await supabase.from("audit_logs").insert({
    actor_type: "admin",
    actor_id: actorId ?? null,
    action: "class_attendance_event_recovered",
    target_type: "ccb_event",
    target_id: event.id,
    metadata_json: {
      group_id: mapping.ccb_group_id,
      schedule_model: "one_event_per_class"
    }
  });

  return {
    ccbEventId: event.id,
    ccbOccurrenceTime,
    created: false
  };
}

function extractTime(value: string | null | undefined) {
  const match = value?.match(/\b([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
  return match ? `${match[1]}:${match[2]}:${match[3] ?? "00"}` : null;
}

function readTime(value: unknown) {
  return typeof value === "string" ? extractTime(value) : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function leaseIsStale(value: string) {
  const startedAt = new Date(value).getTime();
  return Number.isFinite(startedAt) && Date.now() - startedAt >= 10 * 60_000;
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
