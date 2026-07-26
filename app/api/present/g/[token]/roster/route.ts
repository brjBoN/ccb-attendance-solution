import { NextRequest, NextResponse } from "next/server";
import { getPresentRoster } from "@/lib/attendance/present-roster";
import { verifyClassPresentationToken } from "@/lib/checkin/presentation-token";
import { getServerEnv } from "@/lib/env";
import { checkPublicRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRIVATE_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const slug = verifyClassPresentationToken(
    token,
    getServerEnv().SUPABASE_SERVICE_ROLE_KEY
  );
  if (!slug) {
    return NextResponse.json(
      { error: "This class display was not found." },
      { status: 404, headers: PRIVATE_NO_STORE }
    );
  }

  const rate = await checkPublicRateLimit(
    request,
    `roster:${slug}`
  );

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Attendance is refreshing too quickly. Please wait a moment." },
      {
        status: 429,
        headers: {
          ...PRIVATE_NO_STORE,
          "Retry-After": String(rate.retryAfterSeconds)
        }
      }
    );
  }

  try {
    const roster = await getPresentRoster(token);
    if (!roster) {
      return NextResponse.json(
        { error: "This class display was not found." },
        { status: 404, headers: PRIVATE_NO_STORE }
      );
    }

    return NextResponse.json(roster, { headers: PRIVATE_NO_STORE });
  } catch {
    return NextResponse.json(
      { error: "Attendance could not be refreshed right now." },
      { status: 500, headers: PRIVATE_NO_STORE }
    );
  }
}
