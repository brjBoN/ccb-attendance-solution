import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGroupCreatorForApi } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  groupName: z.string().min(1).optional(),
  ccbEventId: z.string().optional().nullable(),
  ccbEventGroupingId: z.string().optional().nullable(),
  autoAddCheckinsToGroup: z.boolean().optional(),
  enabled: z.boolean().optional()
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireGroupCreatorForApi();
  if (response) return response;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.groupName !== undefined) update.group_name = parsed.data.groupName;
  if (parsed.data.ccbEventId !== undefined) update.ccb_event_id = parsed.data.ccbEventId || null;
  if (parsed.data.ccbEventGroupingId !== undefined) update.ccb_event_grouping_id = parsed.data.ccbEventGroupingId || null;
  if (parsed.data.autoAddCheckinsToGroup !== undefined) update.auto_add_checkins_to_group = parsed.data.autoAddCheckinsToGroup;
  if (parsed.data.enabled !== undefined) update.enabled = parsed.data.enabled;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("ccb_group_mappings").update(update).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mapping: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireGroupCreatorForApi();
  if (response) return response;

  if (request.headers.get("x-confirm-delete") !== "confirmed") {
    return NextResponse.json({ error: "Deletion requires explicit confirmation." }, { status: 409 });
  }

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: mapping, error: readError } = await supabase
    .from("ccb_group_mappings")
    .select("id,group_name,created_by_app,deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!mapping) return NextResponse.json({ error: "Group mapping not found." }, { status: 404 });

  if (mapping.created_by_app) {
    return NextResponse.json(
      { error: "This group was created by the app. Use the protected app-created group deletion action instead of deleting only the local mapping." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("ccb_group_mappings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
