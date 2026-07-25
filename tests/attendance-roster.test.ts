import { describe, expect, it } from "vitest";
import { buildAttendanceRoster } from "@/lib/attendance/roster";

describe("buildAttendanceRoster", () => {
  it("automatically includes the class leader", () => {
    expect(
      buildAttendanceRoster({
        existingCcbIds: ["member-1"],
        localCcbIds: ["member-2"],
        leaderCcbId: "leader-1"
      })
    ).toEqual(["member-1", "member-2", "leader-1"]);
  });

  it("does not duplicate a leader who checked in normally", () => {
    expect(
      buildAttendanceRoster({
        existingCcbIds: ["leader-1"],
        localCcbIds: ["leader-1", "member-1"],
        leaderCcbId: "leader-1"
      })
    ).toEqual(["leader-1", "member-1"]);
  });

  it("ignores missing IDs", () => {
    expect(
      buildAttendanceRoster({
        existingCcbIds: [null, "member-1"],
        localCcbIds: [undefined],
        leaderCcbId: null
      })
    ).toEqual(["member-1"]);
  });
});
