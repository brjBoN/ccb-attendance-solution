import { NextResponse } from "next/server";
import { requireFullAdminForApi } from "@/lib/auth/api";
import { createCcbClient } from "@/lib/ccb/client";
import { toPublicIndividualMatch } from "@/lib/ccb/privacy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const { response } = await requireFullAdminForApi();
  if (response) return response;

  const supabase = await createSupabaseServerClient();
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabase
    .from("profile_update_requests")
    .update({ status: "pending", processing_started_at: null })
    .eq("status", "processing")
    .lt("processing_started_at", staleBefore);

  const { data, error } = await supabase
    .from("profile_update_requests")
    .select(
      `
      id,
      session_id,
      ccb_individual_id,
      requested_email,
      requested_mobile_phone,
      requested_home_phone,
      status,
      processing_started_at,
      created_at,
      checkin_sessions (
        id,
        title,
        occurrence_date,
        ccb_group_id
      )
    `
    )
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json(
      { error: "Could not load profile update requests." },
      { status: 500 }
    );
  }

  const client = createCcbClient();
  const results = await Promise.all(
    (data ?? []).map(async (request) => {
      try {
        const person = await client.getIndividualProfile({
          individualId: request.ccb_individual_id
        });

        return {
          ...request,
          currentProfile: person ? toPublicIndividualMatch(person) : null
        };
      } catch {
        return {
          ...request,
          currentProfile: null
        };
      }
    })
  );

  return NextResponse.json({ results });
}
