const MINUTES_PER_DAY = 24 * 60;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
] as const;

export type ScheduleWindowInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  opensMinutesBefore: number;
  closesMinutesAfter: number;
};

export function describeScheduleWindow(input: ScheduleWindowInput) {
  if (
    !Number.isInteger(input.dayOfWeek) ||
    input.dayOfWeek < 0 ||
    input.dayOfWeek >= WEEKDAY_NAMES.length
  ) {
    throw new Error("Invalid meeting day.");
  }

  const startMinutes = parseTime(input.startTime);
  const endMinutes = parseTime(input.endTime);
  if (endMinutes <= startMinutes) {
    throw new Error("The meeting must end after it starts.");
  }

  const opensAt = startMinutes - input.opensMinutesBefore;
  const closesAt = endMinutes + input.closesMinutesAfter;

  return {
    dayName: WEEKDAY_NAMES[input.dayOfWeek],
    meetingTime: `${formatClockTime(startMinutes)}–${formatClockTime(endMinutes)}`,
    attendanceWindow: formatWindowRange(
      input.dayOfWeek,
      opensAt,
      closesAt
    )
  };
}

function formatWindowRange(
  meetingDayOfWeek: number,
  opensAt: number,
  closesAt: number
) {
  const opensDayOffset = Math.floor(opensAt / MINUTES_PER_DAY);
  const closesDayOffset = Math.floor(closesAt / MINUTES_PER_DAY);
  const opensTime = formatClockTime(opensAt);
  const closesTime = formatClockTime(closesAt);

  if (opensDayOffset === 0 && closesDayOffset === 0) {
    return `${opensTime}–${closesTime}`;
  }

  return [
    formatDayAndTime(meetingDayOfWeek, opensDayOffset, opensTime),
    formatDayAndTime(meetingDayOfWeek, closesDayOffset, closesTime)
  ].join("–");
}

function formatDayAndTime(
  meetingDayOfWeek: number,
  dayOffset: number,
  time: string
) {
  const dayIndex =
    (meetingDayOfWeek + dayOffset + WEEKDAY_NAMES.length) %
    WEEKDAY_NAMES.length;
  return `${WEEKDAY_NAMES[dayIndex]} ${time}`;
}

function parseTime(value: string) {
  const match = value.match(TIME_PATTERN);
  if (!match) throw new Error("Invalid meeting time.");
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatClockTime(totalMinutes: number) {
  const normalized =
    ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${
    hour24 < 12 ? "AM" : "PM"
  }`;
}
