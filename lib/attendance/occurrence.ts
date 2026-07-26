export type CcbOccurrenceSession = {
  occurrence_date: string;
  occurrence_start_at: string | null;
  options: unknown;
};

export function resolveCcbOccurrence(session: CcbOccurrenceSession) {
  const options = asObject(session.options);
  const explicit =
    typeof options.ccb_occurrence === "string"
      ? options.ccb_occurrence.trim()
      : "";
  if (explicit) return explicit;

  if (session.occurrence_start_at) {
    const date = new Date(session.occurrence_start_at);
    if (!Number.isNaN(date.valueOf())) {
      const configuredTimeZone =
        typeof options.time_zone === "string"
          ? options.time_zone
          : typeof options.timeZone === "string"
            ? options.timeZone
            : "America/New_York";
      const time = timeInZone(date, configuredTimeZone);
      if (time) return `${session.occurrence_date} ${time}`;
    }
  }

  return `${session.occurrence_date} 00:00:00`;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function timeInZone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value])
    );
    if (!values.hour || !values.minute || !values.second) return null;
    return `${values.hour}:${values.minute}:${values.second}`;
  } catch {
    return null;
  }
}
