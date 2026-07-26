import { NextResponse } from "next/server";
import { requireFullAdminForApi } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, response } = await requireFullAdminForApi();
  if (response) return response;

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const reviewedAt = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("profile_update_requests")
    .update({
      status: "rejected",
      reviewed_by: admin?.id,
      reviewed_at: reviewedAt
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id,status,reviewed_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Could not reject this profile update." },
      { status: 500 }
    );
  }

  if (!updated) {
    return NextResponse.json(
      { error: "This profile update is no longer pending." },
      { status: 409 }
    );
  }

  const auditSupabase = createSupabaseAdminClient();
  await auditSupabase.from("audit_logs").insert({
    actor_type: "admin",
    actor_id: admin?.id,
    action: "profile_update_rejected",
    target_type: "profile_update_requests",
    target_id: id,
    metadata_json: {}
  });

  return NextResponse.json({
    status: "rejected",
    message: "The profile update request was rejected.",
    request: updated
  });
}
