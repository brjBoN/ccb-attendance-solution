import { describe, expect, it } from "vitest";
import { safeAuthRedirectPath } from "@/lib/auth/redirect";

describe("safe auth redirect paths", () => {
  it("uses the admin hub by default", () => {
    expect(safeAuthRedirectPath(null)).toBe("/admin");
  });

  it("allows local app paths and query strings", () => {
    expect(safeAuthRedirectPath("/teacher?from=login")).toBe(
      "/teacher?from=login"
    );
  });

  it("rejects absolute, protocol-relative, and backslash redirects", () => {
    expect(safeAuthRedirectPath("https://example.com")).toBe("/admin");
    expect(safeAuthRedirectPath("//example.com/path")).toBe("/admin");
    expect(safeAuthRedirectPath("/\\example.com/path")).toBe("/admin");
  });
});
