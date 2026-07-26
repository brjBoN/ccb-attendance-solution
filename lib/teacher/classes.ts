import "server-only";

import { signClassPresentationToken } from "@/lib/checkin/presentation-token";
import { describeScheduleWindow } from "@/lib/checkin/schedule-window";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeacherMappingRow = {
  id: string;
  ccb_group_id: string;
  group_name: string;
  public_checkin_slug: string;
};

type TeacherScheduleRow = {
  group_mapping_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  checkin_opens_minutes_before: number;
  checkin_closes_minutes_after: number;
};

export type TeacherClass = {
  id: string;
  name: string;
  ccbGroupId: string;
  imageUrl: string;
  presentationHref: string;
  schedule: Array<{
    dayName: string;
    meetingTime: string;
  }>;
};

export async function listPublicTeacherClasses(): Promise<TeacherClass[]> {
  const supabase = createSupabaseAdminClient();
  const query = supabase
    .from("ccb_group_mappings")
    .select("id,ccb_group_id,group_name,public_checkin_slug")
    .eq("enabled", true)
    .is("deleted_at", null)
    .order("group_name", { ascending: true });

  const { data, error } = await query;
  if (error) throw new Error(`Could not load check-in classes: ${error.message}`);

  const mappings = ((data ?? []) as TeacherMappingRow[]).filter(
    (mapping) => Boolean(mapping.public_checkin_slug)
  );
  if (!mappings.length) return [];

  const { data: scheduleData, error: scheduleError } = await supabase
    .from("class_schedule_slots")
    .select(
      "group_mapping_id,day_of_week,start_time,end_time,checkin_opens_minutes_before,checkin_closes_minutes_after"
    )
    .in(
      "group_mapping_id",
      mappings.map((mapping) => mapping.id)
    )
    .eq("enabled", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (scheduleError) {
    throw new Error(`Could not load class schedules: ${scheduleError.message}`);
  }

  const schedulesByMapping = new Map<string, TeacherScheduleRow[]>();
  for (const row of (scheduleData ?? []) as TeacherScheduleRow[]) {
    const existing = schedulesByMapping.get(row.group_mapping_id) ?? [];
    existing.push(row);
    schedulesByMapping.set(row.group_mapping_id, existing);
  }

  const secret = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;

  return mappings.map((mapping) => {
    const presentationToken = signClassPresentationToken(
      mapping.public_checkin_slug,
      secret
    );
    const presentationPath = `/present/g/${encodeURIComponent(
      presentationToken
    )}`;
    const schedule = (schedulesByMapping.get(mapping.id) ?? []).map((slot) => {
      const description = describeScheduleWindow({
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        opensMinutesBefore: slot.checkin_opens_minutes_before,
        closesMinutesAfter: slot.checkin_closes_minutes_after
      });
      return {
        dayName: description.dayName,
        meetingTime: description.meetingTime
      };
    });

    return {
      id: mapping.id,
      name: mapping.group_name,
      ccbGroupId: mapping.ccb_group_id,
      imageUrl: `${presentationPath}/image`,
      presentationHref: `${presentationPath}?from=teacher`,
      schedule
    };
  });
}
