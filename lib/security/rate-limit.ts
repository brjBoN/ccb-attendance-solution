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
  const retryAfterSeconds = retryAfterWindow(windowStart, windowMs, now);
  try {
    const { data, error } = await supabase.rpc("consume_public_rate_limit", {
      p_rate_key: rateKey,
      p_window_start: windowStart,
      p_max_attempts: env.PUBLIC_RATE_LIMIT_MAX_ATTEMPTS,
      p_window_seconds: env.PUBLIC_RATE_LIMIT_WINDOW_SECONDS
    });

    if (error) {
      return { allowed: false, retryAfterSeconds };
    }

    const result = firstRateLimitRow(data);
    if (!result) {
      return { allowed: false, retryAfterSeconds };
    }

    if (result.allowed) {
      return {
        allowed: true,
        remaining: nonNegativeInteger(result.remaining)
      };
    }

    return {
      allowed: false,
      retryAfterSeconds: positiveInteger(
        result.retry_after_seconds,
        retryAfterSeconds
      )
    };
  } catch {
    return { allowed: false, retryAfterSeconds };
  }
}

type AtomicRateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

function firstRateLimitRow(value: unknown): AtomicRateLimitRow | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return null;

  const row = candidate as Record<string, unknown>;
  if (
    typeof row.allowed !== "boolean" ||
    typeof row.remaining !== "number" ||
    !Number.isFinite(row.remaining) ||
    typeof row.retry_after_seconds !== "number" ||
    !Number.isFinite(row.retry_after_seconds)
  ) {
    return null;
  }

  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retry_after_seconds: row.retry_after_seconds
  };
}

function retryAfterWindow(windowStart: string, windowMs: number, now: Date) {
  return Math.max(
    Math.ceil(
      (new Date(windowStart).getTime() + windowMs - now.getTime()) / 1000
    ),
    1
  );
}

function positiveInteger(value: number, fallback: number) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}
