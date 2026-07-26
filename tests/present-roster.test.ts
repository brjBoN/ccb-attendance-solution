import { describe, expect, it } from "vitest";
import { resolveCcbOccurrence } from "@/lib/attendance/occurrence";
import {
  buildPublicPresentRoster,
  formatPublicAttendanceName,
  isPresentCheckinStatus,
  sanitizeAttendanceName
} from "@/lib/attendance/present-roster-view";

describe("leader present roster", () => {
  it("merges the same person by CCB ID and prefers an authoritative name", () => {
    const roster = buildPublicPresentRoster(
      "session-1",
      [
        {
          ccbIndividualId: "leader-1",
          name: "Class leader",
          nameSource: "metadata",
          isLeader: true
        },
        {
          ccbIndividualId: "leader-1",
          name: "Jordan Matthews",
          nameSource: "profile"
        },
        {
          ccbIndividualId: "member-1",
          name: "Spoofed Name",
          nameSource: "metadata"
        },
        {
          ccbIndividualId: "member-1",
          name: "Alexandra Williams",
          nameSource: "ccb"
        }
      ],
      "test-roster-secret"
    );

    expect(roster).toEqual([
      expect.objectContaining({
        name: "Jordan M.",
        isLeader: true
      }),
      expect.objectContaining({
        name: "Alexandra W.",
        isLeader: false
      })
    ]);
    expect(roster[0].key).not.toContain("leader-1");
    expect(roster[1].key).not.toContain("member-1");
  });

  it("keeps two different people even when their privacy-safe names match", () => {
    const roster = buildPublicPresentRoster(
      "session-1",
      [
        {
          ccbIndividualId: "person-1",
          name: "Chris Smith",
          nameSource: "ccb"
        },
        {
          ccbIndividualId: "person-2",
          name: "Chris Sanders",
          nameSource: "ccb"
        }
      ],
      "test-roster-secret"
    );

    expect(roster).toHaveLength(2);
    expect(roster.map((person) => person.name)).toEqual([
      "Chris S.",
      "Chris S."
    ]);
    expect(roster[0].key).not.toBe(roster[1].key);
  });

  it("formats names with a first name and last initial", () => {
    expect(formatPublicAttendanceName("Taylor Morgan")).toBe("Taylor M.");
    expect(formatPublicAttendanceName("Taylor Morgan Jr.")).toBe("Taylor M.");
    expect(formatPublicAttendanceName("Cher")).toBe("Cher");
    expect(formatPublicAttendanceName("Class leader")).toBe("Group leader");
    expect(formatPublicAttendanceName("Group leader")).toBe("Group leader");
    expect(formatPublicAttendanceName("Present participant")).toBe(
      "Present participant"
    );
  });

  it("sanitizes control characters and long metadata names", () => {
    expect(sanitizeAttendanceName("  Jordan\u0000   Matthews  ")).toBe(
      "Jordan Matthews"
    );
    expect(sanitizeAttendanceName("x".repeat(200))).toHaveLength(160);
    expect(sanitizeAttendanceName(" \n\t ")).toBeNull();
  });

  it("includes locally present and sync-pending rows but excludes failures", () => {
    expect(isPresentCheckinStatus("success")).toBe(true);
    expect(isPresentCheckinStatus("pending")).toBe(true);
    expect(isPresentCheckinStatus("duplicate")).toBe(true);
    expect(isPresentCheckinStatus("failed")).toBe(false);
    expect(isPresentCheckinStatus("needs_review")).toBe(false);
  });

  it("uses the exact recurring CCB occurrence stored on the session", () => {
    expect(
      resolveCcbOccurrence({
        occurrence_date: "2026-07-26",
        occurrence_start_at: "2026-07-26T14:15:00.000Z",
        options: {
          ccb_occurrence: "2026-07-26 10:15:00"
        }
      })
    ).toBe("2026-07-26 10:15:00");
  });

  it("falls back to the session timestamp when no explicit occurrence exists", () => {
    expect(
      resolveCcbOccurrence({
        occurrence_date: "2026-07-26",
        occurrence_start_at: "2026-07-26T14:15:30.000Z",
        options: {}
      })
    ).toBe("2026-07-26 10:15:30");
  });
});
