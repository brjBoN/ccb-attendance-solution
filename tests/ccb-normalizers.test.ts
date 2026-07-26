import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import {
  normalizeAttendanceProfile,
  normalizeEvents,
  normalizeGroups,
  normalizeIndividuals
} from "@/lib/ccb/normalizers";
import { toPublicIndividualMatch } from "@/lib/ccb/privacy";
import { buildEventAttendanceXml } from "@/lib/ccb/attendance-xml";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  processEntities: false
});

function fixture(name: string) {
  const xml = readFileSync(join(process.cwd(), "tests", "fixtures", "ccb", name), "utf-8");
  return parser.parse(xml);
}

describe("CCB normalizers", () => {
  it("normalizes individual search responses", () => {
    const people = normalizeIndividuals(fixture("individual-search.xml"));

    expect(people).toHaveLength(2);
    expect(people[0]).toMatchObject({
      id: "101",
      firstName: "John",
      lastName: "Smith",
      fullName: "John Smith",
      email: "john@example.com",
      mobilePhone: "555-111-2222",
      homePhone: "555-333-4444",
      campus: "Main Campus",
      status: "Active"
    });
  });

  it("masks public individual matches", () => {
    const people = normalizeIndividuals(fixture("individual-search.xml"));
    const publicMatch = toPublicIndividualMatch(people[0]);

    expect(publicMatch.maskedEmail).toBe("j***@example.com");
    expect(publicMatch.maskedMobilePhone).toBe("•••-•••-2222");
  });

  it("normalizes group profile responses", () => {
    const groups = normalizeGroups(fixture("group-profiles.xml"));

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: "501",
      name: "Tuesday Small Group",
      groupType: "Small Group",
      groupTypeId: "21",
      campus: "Main Campus",
      campusId: "1",
      leaderName: "Jane Leader",
      mainLeaderId: "515",
      departmentId: "32",
      areaId: "1",
      capacity: "12",
      meetingDayId: "6",
      meetingTimeId: "8",
      childcareProvided: true,
      notification: true,
      meetingLocationStreetAddress: "100 Main St",
      meetingLocationCity: "Thomasville",
      meetingLocationState: "GA",
      meetingLocationZip: "31792"
    });
  });

  it("normalizes event profile responses", () => {
    const events = normalizeEvents(fixture("event-profiles.xml"));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "701",
      name: "Tuesday Small Group Attendance",
      groupId: "501",
      eventGroupingId: "2",
      eventGroupingName: "Small Groups",
      timeZone: "America/New_York",
      listed: false
    });
  });

  it("normalizes attendance profile responses", () => {
    const attendance = normalizeAttendanceProfile(fixture("attendance-profile.xml"));

    expect(attendance).toMatchObject({
      id: "901",
      eventId: "701",
      occurrenceDate: "2026-05-12"
    });
    expect(attendance.attendees).toEqual([
      expect.objectContaining({
        id: "101",
        name: "John Smith",
        status: "present"
      })
    ]);
  });
  it("normalizes the documented attendance_profile event shape", () => {
    const attendance = normalizeAttendanceProfile(fixture("attendance-profile-actual.xml"));

    expect(attendance).toMatchObject({
      eventId: "756",
      occurrenceDate: "2026-06-22 18:30:00",
      didNotMeet: false,
      headCount: 3,
      topic: "Community",
      notes: "Bring snacks"
    });
    expect(attendance.attendees).toEqual([
      expect.objectContaining({ id: "10", name: "Ben Bolton" }),
      expect.objectContaining({ id: "25", name: "Amy Jones" })
    ]);
  });

  it("builds a deduplicated and XML-escaped attendance upload", () => {
    const xml = buildEventAttendanceXml({
      eventId: "1453",
      occurrence: "2026-06-22 18:30:00",
      individualIds: ["10", "25", "10"],
      topic: "Faith & Community",
      notes: "Use <main> room",
      emailNotification: "none"
    });

    expect(xml.match(/attendee id=/g)).toHaveLength(2);
    expect(xml).toContain('<event id="1453" occurrence="2026-06-22 18:30:00">');
    expect(xml).toContain("<head_count>2</head_count>");
    expect(xml).toContain("Faith &amp; Community");
    expect(xml).toContain("Use &lt;main&gt; room");
  });

});
