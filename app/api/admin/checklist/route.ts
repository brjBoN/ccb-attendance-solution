import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFullAdminForApi } from "@/lib/auth/api";
import { ensureGroupSetupChecklist } from "@/lib/checklist/group-setup";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const initializeSchema = z.object({ mappingId: z.string().uuid() });

export async function GET() {
  const { response } = await requireFullAdminForApi();
  if (response) return response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ccb_group_mappings")
    .select(`
      id,
      ccb_group_id,
      group_name,
      ccb_main_leader_id,
      enabled,
      created_at,
      ccb_group_setup_checklist (
        id,
        checklist_key,
        label,
        intended_value,
        instructions,
        status,
        required_for_qr,
        sort_order,
        notes,
        completed_at,
        completed_by,
        updated_at
      )
    `)
    .order("group_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ccbOrigin = new URL(getServerEnv().CCB_API_URL).origin;
  return NextResponse.json({ results: data ?? [], ccbGroupListUrl: `${ccbOrigin}/group_list.php` });
}

export async function POST(request: NextRequest) {
  const { response } = await requireFullAdminForApi();
  if (response) return response;

  const parsed = initializeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checklist initialization payload." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: mapping, error: mappingError } = await supabase
    .from("ccb_group_mappings")
    .select("*")
    .eq("id", parsed.data.mappingId)
    .single();

  if (mappingError || !mapping) {
    return NextResponse.json({ error: mappingError?.message ?? "Group mapping not found." }, { status: 404 });
  }

  const { data: log } = await supabase
    .from("ccb_group_create_logs")
    .select("request_payload")
    .eq("ccb_group_id", mapping.ccb_group_id)
    .eq("status", "created")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = log?.request_payload as Record<string, unknown> | null;
  const metadata =
    payload?.localOnlyMetadata && typeof payload.localOnlyMetadata === "object"
      ? (payload.localOnlyMetadata as Record<string, unknown>)
      : {};

  const result = await ensureGroupSetupChecklist(supabase, {
    groupMappingId: mapping.id,
    ccbGroupId: mapping.ccb_group_id,
    metadata
  });

  return NextResponse.json({ ok: true, inserted: result.inserted });
}
