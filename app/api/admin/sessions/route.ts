import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { requireAdminForApi } from "@/lib/auth/api";
import { canManageSessionForGroup, isFullAdminRole } from "@/lib/auth/permissions";
import { createCcbClient } from "@/lib/ccb/client";
import { CcbClientError } from "@/lib/ccb/types";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildCheckinUrl, generateCheckinToken, hashCheckinToken } from "@/lib/tokens";

const createSchema = z.object({
  mappingId: z.string().uuid(),
  title: z.string().trim().min(1),
  ccbEventId: z.string().trim().optional().or(z.literal("")),
  occurrenceDate: z.string().min(1),
  occurrenceStartAt: z.string().datetime().optional().nullable(),
  occurrenceEndAt: z.string().datetime().optional().nullable(),
  occurrenceLocalStart: z.string().min(1),
  occurrenceLocalEnd: z.string().min(1),
  checkinOpensAt: z.string().datetime().optional().nullable(),
  checkinClosesAt: z.string().datetime().optional().nullable(),
  tokenExpiresAt: z.string().datetime().optional().nullable(),
  status: z.enum(["draft", "active"]).default("active"),
  createEventIfMissing: z.boolean().default(true),
  eventDescription: z.string().max(4000).optional().or(z.literal("")),
  eventGroupingId: z.string().trim().optional().or(z.literal("")),
  autoAddCheckinsToGroup: z.boolean().default(true),
  recurrenceType: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  recurrenceFrequency: z.coerce.number().int().positive().max(52).default(1),
  recurrenceWeekNumber: z.enum(["", "first", "second", "third", "fourth", "last"]).default(""),
  recurrenceDayOfWeek: z.enum(["", "mon", "tue", "wed", "thu", "fri", "sat", "sun"]).default(""),
  recurrenceDayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
  recurrenceEndDate: z.string().optional().or(z.literal("")),
  numberOfOccurrences: z.coerce.number().int().positive().max(520).optional().nullable(),
  eventListed: z.boolean().default(false),
  attendanceReminder: z.boolean().default(true),
  eventNotification: z.boolean().default(false)
});

export async function GET() {
  const { admin, response } = await requireAdminForApi();
  if (response || !admin) return response;

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("checkin_sessions")
    .select(`
      *,
      checkin_tokens (
        id,
        label,
        expires_at,
        revoked_at,
        created_at
      )
    `)
    .order("created_at", { ascending: false });

  if (!isFullAdminRole(admin.role)) {
    if (!admin.ccbIndividualId) return NextResponse.json({ results: [] });

    const { data: mappings, error: mappingError } = await supabase
      .from("ccb_group_mappings")
      .select("ccb_group_id")
      .eq("ccb_main_leader_id", admin.ccbIndividualId);

    if (mappingError) return NextResponse.json({ error: mappingError.message }, { status: 500 });
    const groupIds = (mappings ?? []).map((mapping) => mapping.ccb_group_id);
    if (!groupIds.length) return NextResponse.json({ results: [] });
    query = query.in("ccb_group_id", groupIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { admin, response } = await requireAdminForApi();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid session payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: mapping, error: mappingError } = await supabase
    .from("ccb_group_mappings")
    .select("*")
    .eq("id", input.mappingId)
    .single();

  if (mappingError || !mapping) {
    return NextResponse.json(
      { error: mappingError?.message ?? "Group mapping not found." },
      { status: 404 }
    );
  }

  if (!canManageSessionForGroup(admin, mapping)) {
    return NextResponse.json(
      { error: "Only this group's main leader or a full administrator can create its QR sessions." },
      { status: 403 }
    );
  }

  let resolvedEventId = input.ccbEventId || mapping.ccb_event_id || "";
  const resolvedEventGroupingId = input.eventGroupingId || mapping.ccb_event_grouping_id || "";
  let createdEvent: { id: string; name: string | null } | null = null;
  const ccbOccurrence = toCcbDateTime(input.occurrenceLocalStart);

  try {
    if (!resolvedEventId) {
      if (!input.createEventIfMissing) {
        return NextResponse.json(
          { error: "No CCB event ID is mapped. Enable automatic event creation or enter an event ID." },
          { status: 400 }
        );
      }

      if (!resolvedEventGroupingId) {
        return NextResponse.json(
          {
            error:
              "Select a CCB Attendance Grouping before automatically creating an event. Without it, CCB creates the event with Attendance Grouping = None and it will not behave correctly for check-in/attendance reporting."
          },
          { status: 400 }
        );
      }

      const client = createCcbClient();
      const recurrenceDefaults = getRecurrenceDefaults({
        recurrenceType: input.recurrenceType,
        occurrenceLocalStart: input.occurrenceLocalStart,
        recurrenceWeekNumber: input.recurrenceWeekNumber || undefined,
        recurrenceDayOfWeek: input.recurrenceDayOfWeek || undefined,
        recurrenceDayOfMonth: input.recurrenceDayOfMonth ?? undefined
      });

      const eventResult = await client.createEvent({
        groupId: mapping.ccb_group_id,
        startDate: toCcbDateTime(input.occurrenceLocalStart),
        endDate: toCcbDateTime(input.occurrenceLocalEnd),
        name: input.title,
        description: input.eventDescription || undefined,
        eventGroupingId: resolvedEventGroupingId,
        recurrenceType: input.recurrenceType === "none" ? undefined : input.recurrenceType,
        recurrenceFrequency: input.recurrenceType === "none" ? undefined : input.recurrenceFrequency,
        recurrenceWeekNumber: recurrenceDefaults.recurrenceWeekNumber,
        recurrenceDayOfWeek: recurrenceDefaults.recurrenceDayOfWeek,
        recurrenceDayOfMonth: recurrenceDefaults.recurrenceDayOfMonth,
        recurrenceEndDate: input.recurrenceEndDate || undefined,
        numberOfOccurrences: input.numberOfOccurrences ?? undefined,
        listed: input.eventListed,
        attendanceReminder: input.attendanceReminder,
        notification: input.eventNotification,
        usesResources: false,
        useCampusAddress: false
      });

      resolvedEventId = readId(eventResult);
      if (!resolvedEventId) {
        throw new Error("CCB created the event, but the event ID could not be read from the response.");
      }

      createdEvent = {
        id: resolvedEventId,
        name: readName(eventResult) ?? input.title
      };

      const { error: mappingUpdateError } = await supabase
        .from("ccb_group_mappings")
        .update({
          ccb_event_id: resolvedEventId,
          ccb_event_grouping_id: resolvedEventGroupingId || null,
          auto_add_checkins_to_group: input.autoAddCheckinsToGroup
        })
        .eq("id", mapping.id);

      if (mappingUpdateError) throw new Error(mappingUpdateError.message);

      await supabase.from("audit_logs").insert({
        actor_type: "admin",
        actor_id: admin?.id,
        action: "ccb_event_created_for_group",
        target_type: "ccb_event",
        target_id: resolvedEventId,
        metadata_json: {
          group_id: mapping.ccb_group_id,
          group_name: mapping.group_name,
          recurrence_type: input.recurrenceType,
          event_grouping_id: resolvedEventGroupingId
        }
      });
    } else if (resolvedEventGroupingId || input.autoAddCheckinsToGroup !== mapping.auto_add_checkins_to_group) {
      await supabase
        .from("ccb_group_mappings")
        .update({
          ccb_event_grouping_id: resolvedEventGroupingId || mapping.ccb_event_grouping_id || null,
          auto_add_checkins_to_group: input.autoAddCheckinsToGroup
        })
        .eq("id", mapping.id);
    }

    const { data: session, error: sessionError } = await supabase
      .from("checkin_sessions")
      .insert({
        ccb_group_id: mapping.ccb_group_id,
        ccb_event_id: resolvedEventId,
        title: input.title,
        occurrence_date: input.occurrenceDate,
        occurrence_start_at: input.occurrenceStartAt || null,
        occurrence_end_at: input.occurrenceEndAt || null,
        checkin_opens_at: input.checkinOpensAt || null,
        checkin_closes_at: input.checkinClosesAt || null,
        status: input.status,
        created_by: admin?.id,
        options: {
          mapping_id: mapping.id,
          group_name: mapping.group_name,
          ccb_occurrence: ccbOccurrence,
          event_created_by_app: Boolean(createdEvent),
          recurrence_type: input.recurrenceType,
          event_grouping_id: resolvedEventGroupingId || null,
          auto_add_checkins_to_group: input.autoAddCheckinsToGroup
        }
      })
      .select("*")
      .single();

    if (sessionError || !session) {
      throw new Error(sessionError?.message ?? "Could not create session.");
    }

    const token = generateCheckinToken();
    const tokenHash = hashCheckinToken(token);
    const { data: tokenRow, error: tokenError } = await supabase
      .from("checkin_tokens")
      .insert({
        session_id: session.id,
        token_hash: tokenHash,
        label: "Initial QR token",
        expires_at: input.tokenExpiresAt || null
      })
      .select("id,expires_at,created_at")
      .single();

    if (tokenError) throw new Error(tokenError.message);

    const env = getServerEnv();
    const checkinUrl = buildCheckinUrl(env.APP_BASE_URL, token);
    const qrDataUrl = await QRCode.toDataURL(checkinUrl, { margin: 2, width: 768 });

    return NextResponse.json({
      session,
      createdEvent,
      token: {
        id: tokenRow.id,
        checkinUrl,
        qrDataUrl,
        expiresAt: tokenRow.expires_at
      }
    });
  } catch (error) {
    const message =
      error instanceof CcbClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown session/event creation error.";

    return NextResponse.json(
      {
        error: message,
        ccbService: error instanceof CcbClientError ? error.service : undefined,
        ccbStatus: error instanceof CcbClientError ? error.status : undefined,
        ccbResponse: error instanceof CcbClientError ? error.responseBody : undefined
      },
      { status: 500 }
    );
  }
}

function toCcbDateTime(value: string) {
  const normalized = value.trim().replace("T", " ");
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)
    ? `${normalized}:00`
    : normalized;
}

function getRecurrenceDefaults(input: {
  recurrenceType: "none" | "daily" | "weekly" | "monthly";
  occurrenceLocalStart: string;
  recurrenceWeekNumber?: "first" | "second" | "third" | "fourth" | "last";
  recurrenceDayOfWeek?: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  recurrenceDayOfMonth?: number;
}) {
  if (input.recurrenceType === "weekly") {
    return {
      recurrenceDayOfWeek: input.recurrenceDayOfWeek ?? getCcbDayOfWeek(input.occurrenceLocalStart),
      recurrenceWeekNumber: undefined,
      recurrenceDayOfMonth: undefined
    };
  }

  if (input.recurrenceType === "monthly") {
    if (input.recurrenceWeekNumber) {
      return {
        recurrenceWeekNumber: input.recurrenceWeekNumber,
        recurrenceDayOfWeek: input.recurrenceDayOfWeek ?? getCcbDayOfWeek(input.occurrenceLocalStart),
        recurrenceDayOfMonth: undefined
      };
    }

    return {
      recurrenceWeekNumber: undefined,
      recurrenceDayOfWeek: undefined,
      recurrenceDayOfMonth:
        input.recurrenceDayOfMonth ?? new Date(input.occurrenceLocalStart).getDate()
    };
  }

  return {
    recurrenceWeekNumber: undefined,
    recurrenceDayOfWeek: undefined,
    recurrenceDayOfMonth: undefined
  };
}

function getCcbDayOfWeek(localDateTime: string): "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" {
  const date = new Date(localDateTime);
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  return days[date.getDay()] ?? "sun";
}

function readId(value: unknown) {
  return value && typeof value === "object" && "id" in value
    ? String((value as { id: unknown }).id)
    : "";
}

function readName(value: unknown) {
  return value && typeof value === "object" && "name" in value
    ? String((value as { name: unknown }).name ?? "") || null
    : null;
}
