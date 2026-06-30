import { NextResponse } from "next/server";
import { requireSessionManagerForApi } from "@/lib/auth/api";
import { syncAttendanceCheckin } from "@/lib/attendance/sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: checkin, error } = await supabase
    .from("attendance_checkins")
    .select("session_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !checkin) {
    return NextResponse.json({ error: error?.message ?? "Check-in not found." }, { status: 404 });
  }

  const { response } = await requireSessionManagerForApi(checkin.session_id);
  if (response) return response;

  const result = await syncAttendanceCheckin(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
