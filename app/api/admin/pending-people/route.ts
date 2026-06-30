import { NextResponse } from "next/server";
import { requireFullAdminForApi } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const { response } = await requireFullAdminForApi();
  if (response) return response;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pending_people")
    .select(
      `
      *,
      checkin_sessions (
        id,
        title,
        ccb_group_id,
        ccb_event_id,
        occurrence_date
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
