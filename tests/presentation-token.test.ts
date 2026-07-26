import { describe, expect, it } from "vitest";
import {
  signClassPresentationToken,
  verifyClassPresentationToken
} from "@/lib/checkin/presentation-token";

const SLUG = "4723036e-8ecc-46f1-9857-d42edaff1e13";
const SECRET = "test-only-presentation-secret";

describe("teacher presentation tokens", () => {
  it("signs and verifies a class slug", () => {
    const token = signClassPresentationToken(SLUG, SECRET);

    expect(token).not.toBe(SLUG);
    expect(verifyClassPresentationToken(token, SECRET)).toBe(SLUG);
  });

  it("rejects a changed slug, signature, or secret", () => {
    const token = signClassPresentationToken(SLUG, SECRET);
    const changedSlug = `5723036e${token.slice(8)}`;
    const changedSignature = `${token.slice(0, -1)}${
      token.endsWith("A") ? "B" : "A"
    }`;

    expect(verifyClassPresentationToken(changedSlug, SECRET)).toBeNull();
    expect(verifyClassPresentationToken(changedSignature, SECRET)).toBeNull();
    expect(verifyClassPresentationToken(token, "different-secret")).toBeNull();
  });

  it("rejects malformed presentation tokens", () => {
    expect(verifyClassPresentationToken("", SECRET)).toBeNull();
    expect(verifyClassPresentationToken(SLUG, SECRET)).toBeNull();
    expect(
      verifyClassPresentationToken(`${SLUG}.not-a-valid-signature`, SECRET)
    ).toBeNull();
  });
});
