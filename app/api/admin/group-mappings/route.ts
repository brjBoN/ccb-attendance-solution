import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForApi, requireGroupCreatorForApi } from "@/lib/auth/api";
import { isFullAdminRole } from "@/lib/auth/permissions";
import { createCcbClient } from "@/lib/ccb/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  ccbGroupId: z.string().min(1),
  groupName: z.string().min(1),
  ccbEventId: z.string().optional().nullable(),
  ccbEventGroupingId: z.string().optional().nullable(),
  ccbMainLeaderId: z.string().optional().nullable(),
  autoAddCheckinsToGroup: z.boolean().optional(),
  enabled: z.boolean().optional()
});

export async function GET(request: NextRequest) {
  const { admin, response } = await requireAdminForApi();
  if (response || !admin) return response;

  const supabase = createSupabaseAdminClient();
  let query = supabase.from("ccb_group_mappings").select("*").is("deleted_at", null).order("group_name", { ascending: true });

  if (request.nextUrl.searchParams.get("scope") === "session" && !isFullAdminRole(admin.role)) {
    if (!admin.ccbIndividualId) return NextResponse.json({ results: [] });
    query = query.eq("ccb_main_leader_id", admin.ccbIndividualId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { admin, response } = await requireGroupCreatorForApi();
  if (response || !admin) return response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid group mapping payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const groupProfile = await createCcbClient().getGroupProfile({ groupId: parsed.data.ccbGroupId });
  if (!groupProfile) {
    return NextResponse.json({ error: "CCB group not found." }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ccb_group_mappings")
    .upsert(
      {
        ccb_group_id: parsed.data.ccbGroupId,
        group_name: groupProfile.name ?? parsed.data.groupName,
        ccb_event_id: parsed.data.ccbEventId || null,
        ccb_event_grouping_id: parsed.data.ccbEventGroupingId || null,
        ccb_main_leader_id: parsed.data.ccbMainLeaderId || groupProfile.mainLeaderId,
        auto_add_checkins_to_group: parsed.data.autoAddCheckinsToGroup ?? true,
        created_by_app: false,
        enabled: parsed.data.enabled ?? true,
        created_by: admin.id
      },
      { onConflict: "ccb_group_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mapping: data });
}
