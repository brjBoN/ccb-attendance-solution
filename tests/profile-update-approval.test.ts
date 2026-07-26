import { describe, expect, it } from "vitest";
import { profileUpdateApprovalSchema } from "@/lib/admin/profile-update-approval";

describe("profile update approval validation", () => {
  it("accepts only an explicit identity verification attestation", () => {
    expect(
      profileUpdateApprovalSchema.safeParse({ identityVerified: true }).success
    ).toBe(true);

    for (const value of [
      null,
      {},
      { identityVerified: false },
      { identityVerified: "true" },
      { identityVerified: true, bypass: true }
    ]) {
      expect(profileUpdateApprovalSchema.safeParse(value).success).toBe(false);
    }
  });
});
