import { describe, expect, it } from "vitest";
import {
  canCreateGroupsRole,
  canManageSessionForGroup,
  isFullAdminRole
} from "@/lib/auth/permissions";

describe("app permissions", () => {
  it("treats owner and admin as full administrators", () => {
    expect(isFullAdminRole("owner")).toBe(true);
    expect(isFullAdminRole("admin")).toBe(true);
    expect(isFullAdminRole("group_manager")).toBe(false);
    expect(isFullAdminRole("leader")).toBe(false);
  });

  it("allows group managers to create groups", () => {
    expect(canCreateGroupsRole("owner")).toBe(true);
    expect(canCreateGroupsRole("admin")).toBe(true);
    expect(canCreateGroupsRole("group_manager")).toBe(true);
    expect(canCreateGroupsRole("leader")).toBe(false);
  });

  it("allows only the linked CCB main leader or a full admin to manage sessions", () => {
    const mapping = { ccb_main_leader_id: "123" };

    expect(canManageSessionForGroup({ role: "admin", ccbIndividualId: null }, mapping)).toBe(true);
    expect(canManageSessionForGroup({ role: "group_manager", ccbIndividualId: "123" }, mapping)).toBe(true);
    expect(canManageSessionForGroup({ role: "leader", ccbIndividualId: "123" }, mapping)).toBe(true);
    expect(canManageSessionForGroup({ role: "leader", ccbIndividualId: "999" }, mapping)).toBe(false);
    expect(canManageSessionForGroup({ role: "group_manager", ccbIndividualId: null }, mapping)).toBe(false);
  });
});
