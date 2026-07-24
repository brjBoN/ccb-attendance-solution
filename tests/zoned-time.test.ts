import { describe, expect, it } from "vitest";
import {
  nextLocalOccurrence,
  zonedLocalDateTimeToIso
} from "@/lib/time/zoned";

describe("Heritage class time conversion", () => {
  it("converts Eastern summer meeting times to UTC", () => {
    expect(
      zonedLocalDateTimeToIso(
        "2026-07-26",
        "09:00",
        "America/New_York"
      )
    ).toBe("2026-07-26T13:00:00.000Z");
  });

  it("converts Eastern winter meeting times to UTC", () => {
    expect(
      zonedLocalDateTimeToIso(
        "2026-12-06",
        "09:00",
        "America/New_York"
      )
    ).toBe("2026-12-06T14:00:00.000Z");
  });

  it("finds the next weekly local occurrence", () => {
    expect(
      nextLocalOccurrence({
        dayOfWeek: 0,
        startTime: "09:00",
        endTime: "10:15",
        timeZone: "America/New_York",
        now: new Date("2026-07-24T18:00:00.000Z")
      })
    ).toEqual({
      localDate: "2026-07-26",
      startDateTime: "2026-07-26 09:00:00",
      endDateTime: "2026-07-26 10:15:00"
    });
  });
});
