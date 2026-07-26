import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { safeAuthRedirectPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedTypes = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email",
  "email_change"
]);

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = safeAuthRedirectPath(
    requestUrl.searchParams.get("next"),
    type === "recovery" ? "/reset-password" : "/admin"
  );

  if (!tokenHash || !type || !allowedTypes.has(type)) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("Invalid or missing auth confirmation token.")}`,
        requestUrl.origin
      )
    );
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType
  });

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        requestUrl.origin
      )
    );
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
