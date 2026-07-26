import { describe, expect, it } from "vitest";
import { describeScheduleWindow } from "@/lib/checkin/schedule-window";

describe("class attendance window labels", () => {
  it("describes the Discover Sunday meeting and check-in window", () => {
    expect(
      describeScheduleWindow({
        dayOfWeek: 0,
        startTime: "10:15",
        endTime: "12:45",
        opensMinutesBefore: 30,
        closesMinutesAfter: 30
      })
    ).toEqual({
      dayName: "Sunday",
      meetingTime: "10:15 AM–12:45 PM",
      attendanceWindow: "9:45 AM–1:15 PM"
    });
  });

  it("uses each schedule row's configured margins", () => {
    expect(
      describeScheduleWindow({
        dayOfWeek: 3,
        startTime: "18:00:00",
        endTime: "19:30:00",
        opensMinutesBefore: 15,
        closesMinutesAfter: 45
      })
    ).toEqual({
      dayName: "Wednesday",
      meetingTime: "6:00 PM–7:30 PM",
      attendanceWindow: "5:45 PM–8:15 PM"
    });
  });

  it("describes multiple weekly meeting rows independently", () => {
    const windows = [
      {
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
        opensMinutesBefore: 30,
        closesMinutesAfter: 30
      },
      {
        dayOfWeek: 4,
        startTime: "18:30",
        endTime: "20:00",
        opensMinutesBefore: 30,
        closesMinutesAfter: 30
      }
    ].map(describeScheduleWindow);

    expect(windows).toEqual([
      {
        dayName: "Monday",
        meetingTime: "9:00 AM–10:00 AM",
        attendanceWindow: "8:30 AM–10:30 AM"
      },
      {
        dayName: "Thursday",
        meetingTime: "6:30 PM–8:00 PM",
        attendanceWindow: "6:00 PM–8:30 PM"
      }
    ]);
  });
});
