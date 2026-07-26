import { describe, expect, it } from "vitest";
import { getAdminDestinations } from "@/lib/admin/destinations";

function keys(role: Parameters<typeof getAdminDestinations>[0]) {
  return getAdminDestinations(role).map((item) => item.key);
}

describe("admin destination visibility", () => {
  it("shows every admin tool to owner and admin roles", () => {
    expect(keys("owner")).toHaveLength(7);
    expect(keys("admin")).toHaveLength(7);
  });

  it("shows group management and scoped attendance tools to group managers", () => {
    expect(keys("group_manager")).toEqual([
      "schedules",
      "classes",
      "activity"
    ]);
  });

  it("shows leaders only their scoped attendance tools", () => {
    expect(keys("leader")).toEqual(["schedules", "activity"]);
  });
});
