import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  DEFAULT_CLASS_TIME_ZONE,
  ensureClassAttendanceEvent
} from "@/lib/attendance/class-event";
import { requireAdminForApi } from "@/lib/auth/api";
import { canManageSessionForGroup } from "@/lib/auth/permissions";
import { CcbClientError } from "@/lib/ccb/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const slotSchema = z
  .object({
    id: z.string().uuid().optional(),
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  })
  .refine((slot) => slot.endTime > slot.startTime, {
    message: "The ending time must be after the starting time."
  });

const updateSchema = z.object({
  slots: z.array(slotSchema).min(1).max(14)
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authorized = await mappingForRequest(await params);
  if ("response" in authorized) return authorized.response;

  const { data, error } = await createSupabaseAdminClient()
    .from("class_schedule_slots")
    .select("*")
    .eq("group_mapping_id", authorized.mapping.id)
    .eq("enabled", true)
    .order("day_of_week")
    .order("start_time");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data ?? [] });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authorized = await mappingForRequest(await params);
  if ("response" in authorized) return authorized.response;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter at least one valid group meeting time.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const duplicateStarts = new Set<string>();
  for (const slot of parsed.data.slots) {
    const key = `${slot.dayOfWeek}:${slot.startTime}`;
    if (duplicateStarts.has(key)) {
      return NextResponse.json(
        { error: "Each group meeting time must be unique." },
        { status: 400 }
      );
    }
    duplicateStarts.add(key);
  }

  const supabase = createSupabaseAdminClient();
  const requestedIds = parsed.data.slots.flatMap((slot) => (slot.id ? [slot.id] : []));
  if (requestedIds.length) {
    const { data: existing, error } = await supabase
      .from("class_schedule_slots")
      .select("id")
      .eq("group_mapping_id", authorized.mapping.id)
      .in("id", requestedIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if ((existing ?? []).length !== requestedIds.length) {
      return NextResponse.json(
        { error: "One or more schedule rows do not belong to this group." },
        { status: 400 }
      );
    }
  }

  const firstSlot = [...parsed.data.slots].sort(
    (left, right) =>
      left.dayOfWeek - right.dayOfWeek ||
      left.startTime.localeCompare(right.startTime)
  )[0];

  try {
    const event = await ensureClassAttendanceEvent(
      authorized.mapping,
      {
        dayOfWeek: firstSlot.dayOfWeek,
        startTime: firstSlot.startTime,
        endTime: firstSlot.endTime,
        timeZone: DEFAULT_CLASS_TIME_ZONE
      },
      authorized.admin.id
    );

    const rows = parsed.data.slots.map((slot) => ({
      id: slot.id ?? randomUUID(),
      group_mapping_id: authorized.mapping.id,
      day_of_week: slot.dayOfWeek,
      start_time: slot.startTime,
      end_time: slot.endTime,
      time_zone: DEFAULT_CLASS_TIME_ZONE,
      checkin_opens_minutes_before: 30,
      checkin_closes_minutes_after: 30,
      enabled: true,
      created_by: authorized.admin.id
    }));
    const keptIds = rows.map((row) => row.id);
    const { data, error } = await supabase
      .from("class_schedule_slots")
      .upsert(rows, { onConflict: "id" })
      .select("*");
    if (error) throw new Error(error.message);

    const { error: deleteError } = await supabase
      .from("class_schedule_slots")
      .delete()
      .eq("group_mapping_id", authorized.mapping.id)
      .not("id", "in", `(${keptIds.join(",")})`);
    if (deleteError) throw new Error(deleteError.message);

    await supabase.from("audit_logs").insert({
      actor_type: "admin",
      actor_id: authorized.admin.id,
      action: "class_schedule_updated",
      target_type: "ccb_group_mapping",
      target_id: authorized.mapping.id,
      metadata_json: {
        group_id: authorized.mapping.ccb_group_id,
        slot_count: rows.length
      }
    });

    return NextResponse.json({
      results: data ?? [],
      eventCreated: event.created
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not save the group schedule.",
        ccbService: error instanceof CcbClientError ? error.service : undefined
      },
      { status: 500 }
    );
  }
}

async function mappingForRequest({ id }: { id: string }) {
  const { admin, response } = await requireAdminForApi();
  if (response || !admin) return { response: response as NextResponse };

  const { data: mapping, error } = await createSupabaseAdminClient()
    .from("ccb_group_mappings")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !mapping) {
    return {
      response: NextResponse.json(
        { error: error?.message ?? "Group mapping not found." },
        { status: 404 }
      )
    };
  }

  if (!canManageSessionForGroup(admin, mapping)) {
    return {
      response: NextResponse.json(
        { error: "Only this group's main leader or a full administrator can manage its schedule." },
        { status: 403 }
      )
    };
  }

  return { admin, mapping };
}
