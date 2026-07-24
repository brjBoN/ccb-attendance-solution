import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireAdminForApi } from "@/lib/auth/api";
import { canManageSessionForGroup } from "@/lib/auth/permissions";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildClassCheckinUrl } from "@/lib/tokens";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, response } = await requireAdminForApi();
  if (response || !admin) return response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: mapping, error } = await supabase
    .from("ccb_group_mappings")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !mapping) {
    return NextResponse.json(
      { error: error?.message ?? "Class mapping not found." },
      { status: 404 }
    );
  }

  if (!canManageSessionForGroup(admin, mapping)) {
    return NextResponse.json(
      { error: "Only this class's main leader or a full administrator can view its QR code." },
      { status: 403 }
    );
  }

  if (!mapping.public_checkin_slug) {
    return NextResponse.json(
      { error: "The permanent class link is not ready. Run Supabase migration 0008, then try again." },
      { status: 409 }
    );
  }

  const checkinUrl = buildClassCheckinUrl(
    getServerEnv().APP_BASE_URL,
    mapping.public_checkin_slug
  );
  const qrDataUrl = await QRCode.toDataURL(checkinUrl, {
    margin: 2,
    width: 768,
    color: { dark: "#12362fff", light: "#ffffffff" }
  });

  return NextResponse.json({
    classLink: {
      mappingId: mapping.id,
      className: mapping.group_name,
      publicSlug: mapping.public_checkin_slug,
      checkinUrl,
      qrDataUrl
    }
  });
}
