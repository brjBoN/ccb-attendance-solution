import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn()
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    PUBLIC_RATE_LIMIT_WINDOW_SECONDS: 60,
    PUBLIC_RATE_LIMIT_MAX_ATTEMPTS: 20
  })
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: rpcMock
  })
}));

import { checkPublicRateLimit } from "@/lib/security/rate-limit";

describe("public rate limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T13:00:30.000Z"));
    rpcMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the atomic database function and returns its allowance", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          allowed: true,
          remaining: 19,
          retry_after_seconds: 0
        }
      ],
      error: null
    });

    const result = await checkPublicRateLimit(request(), "search:group");

    expect(result).toEqual({ allowed: true, remaining: 19 });
    expect(rpcMock).toHaveBeenCalledWith("consume_public_rate_limit", {
      p_rate_key: "search:group:203.0.113.5",
      p_window_start: "2026-07-26T13:00:00.000Z",
      p_max_attempts: 20,
      p_window_seconds: 60
    });
  });

  it("returns the database retry window when the limit is exhausted", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          allowed: false,
          remaining: 0,
          retry_after_seconds: 27
        }
      ],
      error: null
    });

    await expect(
      checkPublicRateLimit(request(), "submit:group")
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 27
    });
  });

  it("fails closed when the atomic database operation fails", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" }
    });

    await expect(
      checkPublicRateLimit(request(), "profile-update:group:person")
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 30
    });
  });

  it("fails closed when the database call throws", async () => {
    rpcMock.mockRejectedValue(new Error("network unavailable"));

    await expect(
      checkPublicRateLimit(request(), "profile-update:group:person")
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 30
    });
  });
});

function request() {
  return new NextRequest("https://attendheritage.com/checkin", {
    headers: {
      "x-forwarded-for": "203.0.113.5, 198.51.100.7"
    }
  });
}
