import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ccbOccurrenceForDate,
  DEFAULT_CLASS_TIME_ZONE,
  ensureClassAttendanceEvent
} from "@/lib/attendance/class-event";
import { requireAdminForApi } from "@/lib/auth/api";
import { canManageSessionForGroup, isFullAdminRole } from "@/lib/auth/permissions";
import { CcbClientError } from "@/lib/ccb/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { zonedLocalDateTimeToIso } from "@/lib/time/zoned";

const createSchema = z
  .object({
    mappingId: z.string().uuid(),
    title: z.string().trim().max(160).optional().or(z.literal("")),
    meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    note: z.string().trim().max(500).optional().or(z.literal(""))
  })
  .refine((input) => input.endTime > input.startTime, {
    message: "The ending time must be after the starting time."
  });

export async function GET() {
  const { admin, response } = await requireAdminForApi();
  if (response || !admin) return response;

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("checkin_sessions")
    .select("*")
    .order("occurrence_start_at", { ascending: false })
    .limit(250);

  if (!isFullAdminRole(admin.role)) {
    if (!admin.ccbIndividualId) return NextResponse.json({ results: [] });

    const { data: mappings, error: mappingError } = await supabase
      .from("ccb_group_mappings")
      .select("ccb_group_id")
      .eq("ccb_main_leader_id", admin.ccbIndividualId);

    if (mappingError) {
      return NextResponse.json({ error: mappingError.message }, { status: 500 });
    }
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
  if (response || !admin) return response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid date, starting time, and ending time.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: mapping, error: mappingError } = await supabase
    .from("ccb_group_mappings")
    .select("*")
    .eq("id", input.mappingId)
    .is("deleted_at", null)
    .maybeSingle();

  if (mappingError || !mapping) {
    return NextResponse.json(
      { error: mappingError?.message ?? "Group mapping not found." },
      { status: 404 }
    );
  }

  if (!canManageSessionForGroup(admin, mapping)) {
    return NextResponse.json(
      { error: "Only this group's main leader or a full administrator can add a special meeting." },
      { status: 403 }
    );
  }

  try {
    const dayOfWeek = new Date(`${input.meetingDate}T12:00:00Z`).getUTCDay();
    const event = await ensureClassAttendanceEvent(
      mapping,
      {
        dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        timeZone: DEFAULT_CLASS_TIME_ZONE
      },
      admin.id
    );
    const occurrenceStartAt = zonedLocalDateTimeToIso(
      input.meetingDate,
      input.startTime,
      DEFAULT_CLASS_TIME_ZONE
    );
    const occurrenceEndAt = zonedLocalDateTimeToIso(
      input.meetingDate,
      input.endTime,
      DEFAULT_CLASS_TIME_ZONE
    );
    const startMs = new Date(occurrenceStartAt).getTime();
    const endMs = new Date(occurrenceEndAt).getTime();
    const title = input.title || `${mapping.group_name} Special Meeting`;

    const { data: session, error: sessionError } = await supabase
      .from("checkin_sessions")
      .insert({
        ccb_group_id: mapping.ccb_group_id,
        ccb_event_id: event.ccbEventId,
        title,
        occurrence_date: input.meetingDate,
        occurrence_start_at: occurrenceStartAt,
        occurrence_end_at: occurrenceEndAt,
        checkin_opens_at: new Date(startMs - 30 * 60_000).toISOString(),
        checkin_closes_at: new Date(endMs + 30 * 60_000).toISOString(),
        status: "active",
        created_by: admin.id,
        meeting_kind: "special",
        special_case_note: input.note || null,
        options: {
          mapping_id: mapping.id,
          group_name: mapping.group_name,
          ccb_occurrence: ccbOccurrenceForDate(
            input.meetingDate,
            event.ccbOccurrenceTime
          ),
          event_grouping_id: mapping.ccb_event_grouping_id,
          auto_add_checkins_to_group:
            mapping.auto_add_checkins_to_group ?? true,
          meeting_kind: "special"
        }
      })
      .select("*")
      .single();

    if (sessionError || !session) {
      throw new Error(sessionError?.message ?? "Could not add the special meeting.");
    }

    await supabase.from("audit_logs").insert({
      actor_type: "admin",
      actor_id: admin.id,
      action: "special_class_meeting_created",
      target_type: "checkin_session",
      target_id: session.id,
      metadata_json: {
        group_id: mapping.ccb_group_id,
        meeting_date: input.meetingDate
      }
    });

    return NextResponse.json({ session, eventCreated: event.created });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not add the special meeting.",
        ccbService: error instanceof CcbClientError ? error.service : undefined
      },
      { status: 500 }
    );
  }
}
