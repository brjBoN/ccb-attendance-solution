import { describe, expect, it } from "vitest";
import { rankCcbGroups } from "@/lib/ccb/group-search";
import type { CcbGroup } from "@/lib/ccb/types";

function group(id: string, name: string, patch: Partial<CcbGroup> = {}): CcbGroup {
  return {
    id,
    name,
    description: null,
    groupType: null,
    groupTypeId: null,
    campus: null,
    campusId: null,
    leaderName: null,
    mainLeaderId: null,
    department: null,
    departmentId: null,
    area: null,
    areaId: null,
    capacity: null,
    meetingDay: null,
    meetingDayId: null,
    meetingTime: null,
    meetingTimeId: null,
    childcareProvided: null,
    interactionType: null,
    membershipType: null,
    listed: null,
    publicSearchListed: null,
    notification: null,
    meetingLocationStreetAddress: null,
    meetingLocationCity: null,
    meetingLocationState: null,
    meetingLocationZip: null,
    inactive: null,
    ...patch
  };
}

describe("rankCcbGroups", () => {
  it("ranks class-name matches above description and leader matches", () => {
    const results = rankCcbGroups(
      [
        group("1", "Sunday Adults", { description: "Discover your purpose" }),
        group("2", "Discover Heritage"),
        group("3", "New Members", { leaderName: "Discover Jones" })
      ],
      "discover"
    );

    expect(results.map((result) => result.group.id)).toEqual(["2", "3", "1"]);
    expect(results[0].matchReason).toBe("Class name");
  });

  it("ranks exact names above prefixes and contains matches", () => {
    const results = rankCcbGroups(
      [
        group("1", "The Discover Class"),
        group("2", "Discover Next"),
        group("3", "Discover")
      ],
      "discover"
    );

    expect(results.map((result) => result.group.id)).toEqual(["3", "2", "1"]);
  });
});
