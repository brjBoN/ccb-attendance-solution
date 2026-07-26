import { describe, expect, it } from "vitest";
import {
  normalizeProfileUpdateRequest,
  profileUpdateRequestSchema
} from "@/lib/checkin/profile-update-request";

describe("profile update request validation", () => {
  it("accepts a new email, mobile phone, or both", () => {
    const parsed = profileUpdateRequestSchema.parse({
      ticket: "signed-ticket",
      email: "  person@example.com ",
      mobilePhone: " (555) 123-4567 ",
      homePhone: "555-555-9090"
    });

    expect(normalizeProfileUpdateRequest(parsed)).toEqual({
      ticket: "signed-ticket",
      email: "person@example.com",
      mobilePhone: "(555) 123-4567",
      homePhone: "555-555-9090"
    });
  });

  it("requires at least one contact change", () => {
    expect(
      profileUpdateRequestSchema.safeParse({
        ticket: "signed-ticket",
        email: "",
        mobilePhone: "",
        homePhone: ""
      }).success
    ).toBe(false);
  });

  it("rejects malformed and privileged profile fields", () => {
    expect(
      profileUpdateRequestSchema.safeParse({
        ticket: "signed-ticket",
        email: "not-an-email"
      }).success
    ).toBe(false);
    expect(
      profileUpdateRequestSchema.safeParse({
        ticket: "signed-ticket",
        mobilePhone: "abc"
      }).success
    ).toBe(false);
    expect(
      profileUpdateRequestSchema.safeParse({
        ticket: "signed-ticket",
        email: "person@example.com",
        membershipType: "admin"
      }).success
    ).toBe(false);
  });
});
