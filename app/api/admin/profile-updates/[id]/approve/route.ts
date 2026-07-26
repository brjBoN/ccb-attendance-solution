import { NextResponse } from "next/server";
import { profileUpdateApprovalSchema } from "@/lib/admin/profile-update-approval";
import { requireFullAdminForApi } from "@/lib/auth/api";
import { createCcbClient } from "@/lib/ccb/client";
import { CcbClientError } from "@/lib/ccb/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, response } = await requireFullAdminForApi();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const approval = profileUpdateApprovalSchema.safeParse(body);
  if (!approval.success) {
    return NextResponse.json(
      {
        error:
          "Confirm that this request was verified with the person or a group leader."
      },
      { status: 400 }
    );
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabase
    .from("profile_update_requests")
    .update({ status: "pending", processing_started_at: null })
    .eq("id", id)
    .eq("status", "processing")
    .lt("processing_started_at", staleBefore);

  const processingStartedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("profile_update_requests")
    .update({
      status: "processing",
      processing_started_at: processingStartedAt
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (claimError) {
    return NextResponse.json(
      { error: "Could not begin this profile update." },
      { status: 500 }
    );
  }

  if (!claimed) {
    return NextResponse.json(
      { error: "This profile update is no longer pending." },
      { status: 409 }
    );
  }

  const requestedFields = [
    claimed.requested_email ? "email" : null,
    claimed.requested_mobile_phone ? "mobile_phone" : null,
    claimed.requested_home_phone ? "home_phone" : null
  ].filter(Boolean);

  try {
    const client = createCcbClient();
    const person = await client.getIndividualProfile({
      individualId: claimed.ccb_individual_id
    });

    if (!person) {
      throw new Error("The CCB profile could not be found.");
    }

    await client.updateIndividual({
      individualId: claimed.ccb_individual_id,
      email: claimed.requested_email ?? undefined,
      mobilePhone: claimed.requested_mobile_phone ?? undefined,
      homePhone: claimed.requested_home_phone ?? undefined
    });

    const reviewedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("profile_update_requests")
      .update({
        status: "approved",
        processing_started_at: null,
        reviewed_by: admin?.id,
        reviewed_at: reviewedAt
      })
      .eq("id", id)
      .eq("status", "processing")
      .select("id,status,reviewed_at")
      .single();

    if (updateError) {
      await supabase
        .from("profile_update_requests")
        .update({ status: "pending", processing_started_at: null })
        .eq("id", id)
        .eq("status", "processing");

      return NextResponse.json(
        {
          error:
            "CCB was updated, but the request could not be marked complete. Check CCB before retrying."
        },
        { status: 500 }
      );
    }

    const auditSupabase = createSupabaseAdminClient();
    await auditSupabase.from("audit_logs").insert({
      actor_type: "admin",
      actor_id: admin?.id,
      action: "profile_update_approved",
      target_type: "profile_update_requests",
      target_id: id,
      metadata_json: {
        ccb_individual_id: claimed.ccb_individual_id,
        updated_fields: requestedFields,
        identity_verified: true
      }
    });

    return NextResponse.json({
      status: "approved",
      message: "The CCB profile was updated.",
      request: updated
    });
  } catch (error) {
    await supabase
      .from("profile_update_requests")
      .update({ status: "pending", processing_started_at: null })
      .eq("id", id)
      .eq("status", "processing");

    const message =
      error instanceof CcbClientError
        ? "CCB could not apply this profile update."
        : error instanceof Error
          ? error.message
          : "Could not apply this profile update.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
