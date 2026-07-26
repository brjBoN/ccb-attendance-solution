import "server-only";

import QRCode from "qrcode";
import { verifyClassPresentationToken } from "@/lib/checkin/presentation-token";
import { describeScheduleWindow } from "@/lib/checkin/schedule-window";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildClassCheckinUrl,
  buildClassPresentationUrl
} from "@/lib/tokens";

type DisplayMappingRow = {
  id: string;
  ccb_group_id: string;
  group_name: string;
  public_checkin_slug: string;
  ccb_main_leader_id: string | null;
};

type DisplayScheduleRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  checkin_opens_minutes_before: number;
  checkin_closes_minutes_after: number;
};

export async function getEnabledClassDisplayMapping(
  presentationToken: string
) {
  const env = getServerEnv();
  const slug = verifyClassPresentationToken(
    presentationToken,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (!slug) return null;

  const { data, error } = await createSupabaseAdminClient()
    .from("ccb_group_mappings")
    .select(
      "id,ccb_group_id,group_name,public_checkin_slug,ccb_main_leader_id"
    )
    .eq("public_checkin_slug", slug)
    .eq("enabled", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return data as DisplayMappingRow;
}

export async function getClassPresentation(slug: string) {
  const mapping = await getEnabledClassDisplayMapping(slug);
  if (!mapping) return null;

  const { data: scheduleRows } = await createSupabaseAdminClient()
    .from("class_schedule_slots")
    .select(
      "id,day_of_week,start_time,end_time,checkin_opens_minutes_before,checkin_closes_minutes_after"
    )
    .eq("group_mapping_id", mapping.id)
    .eq("enabled", true)
    .order("day_of_week")
    .order("start_time");

  const env = getServerEnv();
  const checkinUrl = buildClassCheckinUrl(
    env.APP_BASE_URL,
    mapping.public_checkin_slug
  );
  const presentationUrl = buildClassPresentationUrl(
    env.APP_BASE_URL,
    mapping.public_checkin_slug,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
  const qrDataUrl = await QRCode.toDataURL(checkinUrl, {
    margin: 3,
    width: 1200,
    errorCorrectionLevel: "M",
    color: { dark: "#071f3fff", light: "#ffffffff" }
  });

  return {
    className: mapping.group_name,
    checkinUrl,
    presentationUrl,
    qrDataUrl,
    schedule: ((scheduleRows ?? []) as DisplayScheduleRow[]).map((slot) => ({
      id: slot.id,
      ...describeScheduleWindow({
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        opensMinutesBefore: slot.checkin_opens_minutes_before,
        closesMinutesAfter: slot.checkin_closes_minutes_after
      })
    }))
  };
}
