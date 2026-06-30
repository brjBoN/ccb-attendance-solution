import "server-only";

import { NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function checkPublicRateLimit(
  request: NextRequest,
  scope: string
): Promise<RateLimitResult> {
  const env = getServerEnv();
  const supabase = createSupabaseAdminClient();
  const ip = getClientIp(request);
  const now = new Date();
  const windowMs = env.PUBLIC_RATE_LIMIT_WINDOW_SECONDS * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs).toISOString();
  const rateKey = `${scope}:${ip}`;

  const { data: existing } = await supabase
    .from("public_rate_limits")
    .select("id,attempt_count")
    .eq("rate_key", rateKey)
    .eq("window_start", windowStart)
    .maybeSingle();

  if (!existing) {
    await supabase.from("public_rate_limits").insert({
      rate_key: rateKey,
      window_start: windowStart,
      attempt_count: 1
    });

    return {
      allowed: true,
      remaining: Math.max(env.PUBLIC_RATE_LIMIT_MAX_ATTEMPTS - 1, 0)
    };
  }

  if (existing.attempt_count >= env.PUBLIC_RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(
      Math.ceil((new Date(windowStart).getTime() + windowMs - now.getTime()) / 1000),
      1
    );
    return { allowed: false, retryAfterSeconds };
  }

  const nextCount = existing.attempt_count + 1;
  await supabase
    .from("public_rate_limits")
    .update({ attempt_count: nextCount })
    .eq("id", existing.id);

  return {
    allowed: true,
    remaining: Math.max(env.PUBLIC_RATE_LIMIT_MAX_ATTEMPTS - nextCount, 0)
  };
}
