import { describe, expect, it } from "vitest";
import {
  isAllowedCcbGroupImageContentType,
  validatedCcbGroupImageUrl
} from "@/lib/ccb/group-image-url";

describe("CCB group image safety", () => {
  it("allows the tenant's signed group image URL", () => {
    const value =
      "https://ccbchurch.s3.amazonaws.com/30722/pics/group/1786-1024?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=example";

    expect(validatedCcbGroupImageUrl(value)?.toString()).toBe(value);
  });

  it("rejects non-HTTPS, other hosts, and unrelated paths", () => {
    expect(
      validatedCcbGroupImageUrl(
        "http://ccbchurch.s3.amazonaws.com/30722/pics/group/1786-1024"
      )
    ).toBeNull();
    expect(
      validatedCcbGroupImageUrl(
        "https://example.com/30722/pics/group/1786-1024"
      )
    ).toBeNull();
    expect(
      validatedCcbGroupImageUrl(
        "https://ccbchurch.s3.amazonaws.com/other/file.jpg"
      )
    ).toBeNull();
  });

  it("allows only browser-safe raster image content types", () => {
    expect(isAllowedCcbGroupImageContentType("image/jpeg")).toBe(true);
    expect(isAllowedCcbGroupImageContentType("image/png; charset=binary")).toBe(
      true
    );
    expect(isAllowedCcbGroupImageContentType("image/svg+xml")).toBe(false);
    expect(isAllowedCcbGroupImageContentType("text/html")).toBe(false);
  });
});
