import { describe, expect, it } from "vitest";
import { selectCurrentClassSession } from "@/lib/checkin/class-session-selection";

const now = new Date("2026-07-24T18:00:00.000Z");

function session(
  id: string,
  overrides: Partial<{
    status: string;
    occurrence_start_at: string | null;
    checkin_opens_at: string | null;
    checkin_closes_at: string | null;
    created_at: string;
    meeting_kind: string;
  }> = {}
) {
  return {
    id,
    status: "active",
    occurrence_start_at: "2026-07-24T18:00:00.000Z",
    checkin_opens_at: "2026-07-24T17:30:00.000Z",
    checkin_closes_at: "2026-07-24T20:00:00.000Z",
    created_at: "2026-07-24T16:00:00.000Z",
    ...overrides
  };
}

describe("selectCurrentClassSession", () => {
  it("returns the active meeting whose check-in window contains the current time", () => {
    const result = selectCurrentClassSession(
      [
        session("future", {
          checkin_opens_at: "2026-07-24T19:00:00.000Z",
          checkin_closes_at: "2026-07-24T21:00:00.000Z"
        }),
        session("current"),
        session("closed", {
          checkin_opens_at: "2026-07-24T14:00:00.000Z",
          checkin_closes_at: "2026-07-24T17:00:00.000Z"
        })
      ],
      now
    );

    expect(result?.id).toBe("current");
  });

  it("prefers the open meeting closest to its start time", () => {
    const result = selectCurrentClassSession(
      [
        session("earlier", {
          occurrence_start_at: "2026-07-24T15:00:00.000Z",
          checkin_opens_at: null,
          checkin_closes_at: null
        }),
        session("closest", {
          occurrence_start_at: "2026-07-24T18:15:00.000Z",
          checkin_opens_at: null,
          checkin_closes_at: null
        })
      ],
      now
    );

    expect(result?.id).toBe("closest");
  });

  it("prefers a special-case meeting when it overlaps a regular schedule", () => {
    const result = selectCurrentClassSession(
      [
        session("regular", { meeting_kind: "regular" }),
        session("special", {
          meeting_kind: "special",
          occurrence_start_at: "2026-07-24T17:30:00.000Z"
        })
      ],
      now
    );

    expect(result?.id).toBe("special");
  });

  it("does not return draft, closed, cancelled, future, or expired meetings", () => {
    const result = selectCurrentClassSession(
      [
        session("draft", { status: "draft" }),
        session("closed", { status: "closed" }),
        session("cancelled", { status: "cancelled" }),
        session("future", {
          checkin_opens_at: "2026-07-24T18:01:00.000Z"
        }),
        session("expired", {
          checkin_closes_at: "2026-07-24T17:59:00.000Z"
        })
      ],
      now
    );

    expect(result).toBeNull();
  });

  it("honors the exact Discover attendance window boundaries", () => {
    const discover = session("discover", {
      occurrence_start_at: "2026-07-26T14:15:00.000Z",
      checkin_opens_at: "2026-07-26T13:45:00.000Z",
      checkin_closes_at: "2026-07-26T17:15:00.000Z"
    });

    expect(
      selectCurrentClassSession(
        [discover],
        new Date("2026-07-26T13:44:59.999Z")
      )
    ).toBeNull();
    expect(
      selectCurrentClassSession(
        [discover],
        new Date("2026-07-26T13:45:00.000Z")
      )?.id
    ).toBe("discover");
    expect(
      selectCurrentClassSession(
        [discover],
        new Date("2026-07-26T17:15:00.000Z")
      )?.id
    ).toBe("discover");
    expect(
      selectCurrentClassSession(
        [discover],
        new Date("2026-07-26T17:15:00.001Z")
      )
    ).toBeNull();
  });
});
