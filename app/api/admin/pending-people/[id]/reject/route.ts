import { NextResponse } from "next/server";
import { requireFullAdminForApi } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, response } = await requireFullAdminForApi();
  if (response) return response;

  if (_request.headers.get("x-confirm-delete") !== "confirmed") {
    return NextResponse.json(
      { error: "Deletion requires explicit confirmation." },
      { status: 409 }
    );
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: pending, error: readError } = await supabase
    .from("pending_people")
    .select("id,first_name,last_name,email,phone,session_id,status")
    .eq("id", id)
    .single();

  if (readError || !pending) {
    return NextResponse.json(
      { error: readError?.message ?? "Pending guest submission not found." },
      { status: 404 }
    );
  }

  const { error: deleteError } = await supabase
    .from("pending_people")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_type: "admin",
    actor_id: admin?.id,
    action: "pending_guest_deleted",
    target_type: "pending_people",
    target_id: id,
    metadata_json: {
      first_name: pending.first_name,
      last_name: pending.last_name,
      email_present: Boolean(pending.email),
      phone_present: Boolean(pending.phone),
      session_id: pending.session_id,
      previous_status: pending.status
    }
  });

  return NextResponse.json({
    ok: true,
    deletedPendingPersonId: id
  });
}
