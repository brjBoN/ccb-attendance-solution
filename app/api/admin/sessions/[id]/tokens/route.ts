import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireSessionManagerForApi } from "@/lib/auth/api";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildCheckinUrl, generateCheckinToken, hashCheckinToken } from "@/lib/tokens";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { response } = await requireSessionManagerForApi(id);
  if (response) return response;

  const supabase = createSupabaseAdminClient();
  await supabase.from("checkin_tokens").update({ revoked_at: new Date().toISOString() }).eq("session_id", id).is("revoked_at", null);

  const token = generateCheckinToken();
  const tokenHash = hashCheckinToken(token);
  const { data: tokenRow, error: tokenError } = await supabase
    .from("checkin_tokens")
    .insert({ session_id: id, token_hash: tokenHash, label: "Regenerated QR token" })
    .select("id,created_at")
    .single();

  if (tokenError) return NextResponse.json({ error: tokenError.message }, { status: 500 });

  const checkinUrl = buildCheckinUrl(getServerEnv().APP_BASE_URL, token);
  const qrDataUrl = await QRCode.toDataURL(checkinUrl, { margin: 2, width: 768 });
  return NextResponse.json({ token: { id: tokenRow.id, checkinUrl, qrDataUrl } });
}
