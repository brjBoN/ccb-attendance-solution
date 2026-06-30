import { NextResponse } from "next/server";
import { requireSessionManagerForApi } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { response } = await requireSessionManagerForApi(id);
  if (response) return response;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("checkin_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("session_id", id)
    .is("revoked_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
