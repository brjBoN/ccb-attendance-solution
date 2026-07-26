import { describe, expect, it } from "vitest";
import {
  eventIdCandidatesFromUid,
  parseCcbGroupCalendar
} from "@/lib/ccb/group-calendar";

const DISCOVER_CALENDAR = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:30722-8243@ccbchurch.com",
  "SUMMARY:Discover - Summer 2026",
  "DTSTART;TZID=America/New_York:20260607T101500",
  "DTEND;TZID=America/New_York:20260607T124500",
  "RRULE:FREQ=WEEKLY;BYDAY=SU;",
  " UNTIL=20260802T235959Z",
  "END:VEVENT",
  "END:VCALENDAR"
].join("\r\n");

describe("CCB group calendar discovery", () => {
  it("parses an existing recurring event without exposing calendar credentials", () => {
    expect(parseCcbGroupCalendar(DISCOVER_CALENDAR)).toEqual([
      {
        uid: "30722-8243@ccbchurch.com",
        name: "Discover - Summer 2026",
        start: "20260607T101500",
        end: "20260607T124500",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=SU;UNTIL=20260802T235959Z"
      }
    ]);
  });

  it("tries the CCB event component of a compound UID first", () => {
    expect(eventIdCandidatesFromUid("30722-8243@ccbchurch.com")).toEqual([
      "8243",
      "30722"
    ]);
  });

  it("ignores calendar entries without a UID", () => {
    expect(
      parseCcbGroupCalendar("BEGIN:VEVENT\r\nSUMMARY:No identifier\r\nEND:VEVENT")
    ).toEqual([]);
  });
});
