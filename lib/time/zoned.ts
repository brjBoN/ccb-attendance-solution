const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export function zonedLocalDateTimeToIso(
  localDate: string,
  localTime: string,
  timeZone: string
) {
  if (!DATE_PATTERN.test(localDate) || !TIME_PATTERN.test(localTime)) {
    throw new Error("Invalid local date or time.");
  }

  const [year, month, day] = localDate.split("-").map(Number);
  const [, hourText, minuteText, secondText = "00"] =
    localTime.match(TIME_PATTERN) ?? [];
  const desiredWallClock = Date.UTC(
    year,
    month - 1,
    day,
    Number(hourText),
    Number(minuteText),
    Number(secondText)
  );
  let guess = desiredWallClock;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = wallClockEpoch(new Date(guess), timeZone);
    const correction = desiredWallClock - actual;
    guess += correction;
    if (correction === 0) break;
  }

  return new Date(guess).toISOString();
}

export function nextLocalOccurrence(input: {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timeZone: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const parts = zonedParts(now, input.timeZone);
  const localDateEpoch = Date.UTC(parts.year, parts.month - 1, parts.day);
  const currentDayOfWeek = new Date(localDateEpoch).getUTCDay();
  let dayOffset = (input.dayOfWeek - currentDayOfWeek + 7) % 7;
  const currentMinutes = parts.hour * 60 + parts.minute;
  const startMinutes = timeToMinutes(input.startTime);

  if (dayOffset === 0 && currentMinutes >= startMinutes) {
    dayOffset = 7;
  }

  const nextDate = new Date(localDateEpoch + dayOffset * 86_400_000);
  const localDate = [
    nextDate.getUTCFullYear(),
    pad(nextDate.getUTCMonth() + 1),
    pad(nextDate.getUTCDate())
  ].join("-");

  return {
    localDate,
    startDateTime: `${localDate} ${normalizeTime(input.startTime)}`,
    endDateTime: `${localDate} ${normalizeTime(input.endTime)}`
  };
}

export function normalizeTime(value: string) {
  const match = value.match(TIME_PATTERN);
  if (!match) throw new Error("Invalid time.");
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}

function timeToMinutes(value: string) {
  const match = value.match(TIME_PATTERN);
  if (!match) throw new Error("Invalid time.");
  return Number(match[1]) * 60 + Number(match[2]);
}

function wallClockEpoch(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
}

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
