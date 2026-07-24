import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireSessionManagerForApi } from "@/lib/auth/api";
import { getServerEnv } from "@/lib/env";
import { buildClassCheckinUrl } from "@/lib/tokens";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { mapping, response } = await requireSessionManagerForApi(id);
  if (response) return response;

  if (!mapping?.public_checkin_slug) {
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
    },
    message: "This class uses one permanent QR code. No meeting-specific token was created."
  });
}
