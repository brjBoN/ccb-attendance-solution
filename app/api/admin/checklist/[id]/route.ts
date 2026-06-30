import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFullAdminForApi } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  status: z.enum(["pending", "complete", "not_applicable", "needs_review"]),
  notes: z.string().trim().max(1000).optional().or(z.literal(""))
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, response } = await requireFullAdminForApi();
  if (response || !admin) return response;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid checklist update." }, { status: 400 });

  const completed = parsed.data.status === "complete" || parsed.data.status === "not_applicable";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ccb_group_setup_checklist")
    .update({
      status: parsed.data.status,
      notes: parsed.data.notes || null,
      completed_by: completed ? admin.id : null,
      completed_at: completed ? new Date().toISOString() : null
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_logs").insert({
    actor_type: "admin",
    actor_id: admin.id,
    action: "ccb_group_setup_checklist_updated",
    target_type: "ccb_group_setup_checklist",
    target_id: id,
    metadata_json: { status: parsed.data.status }
  });

  return NextResponse.json({ item: data });
}
