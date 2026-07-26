export type CcbCalendarEventReference = {
  uid: string;
  name: string | null;
  start: string | null;
  end: string | null;
  recurrenceRule: string | null;
};

export function parseCcbGroupCalendar(ics: string): CcbCalendarEventReference[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

  return blocks.flatMap((block) => {
    const properties = new Map<string, string>();

    for (const line of block.split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      const property = line.slice(0, separator).split(";", 1)[0]?.toUpperCase();
      if (!property || properties.has(property)) continue;
      properties.set(property, line.slice(separator + 1).trim());
    }

    const uid = properties.get("UID")?.trim();
    if (!uid) return [];

    return [{
      uid,
      name: decodeIcalendarText(properties.get("SUMMARY")),
      start: properties.get("DTSTART") ?? null,
      end: properties.get("DTEND") ?? null,
      recurrenceRule: properties.get("RRULE") ?? null
    }];
  });
}

export function eventIdCandidatesFromUid(uid: string) {
  const localPart = uid.split("@", 1)[0] ?? "";
  const ids = localPart.match(/\d+/g) ?? [];
  return [...new Set(ids.reverse())];
}

function decodeIcalendarText(value: string | undefined) {
  if (!value) return null;
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim() || null;
}
