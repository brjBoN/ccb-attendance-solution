import type { CreateEventAttendanceInput } from "@/lib/ccb/types";

export function buildEventAttendanceXml(input: CreateEventAttendanceInput) {
  const ids = [...new Set(input.individualIds.map(String).filter(Boolean))];
  // CCB treats head_count as additional unnamed attendees and adds it to the
  // occurrence on each upload. Named attendees belong only in <attendees>.
  const headCount = input.headCount ?? 0;

  return `<?xml version="1.0" encoding="UTF-8"?>\n<events>\n  <event id="${escapeXml(input.eventId)}" occurrence="${escapeXml(input.occurrence)}">\n    <did_not_meet>${input.didNotMeet ? "true" : "false"}</did_not_meet>\n    <head_count>${headCount}</head_count>\n    <attendees>\n${ids
    .map((id) => `      <attendee id="${escapeXml(id)}"></attendee>`)
    .join("\n")}\n    </attendees>\n    <topic>${escapeXml(input.topic ?? "")}</topic>\n    <notes>${escapeXml(input.notes ?? "")}</notes>\n    <prayer_requests>${escapeXml(input.prayerRequests ?? "")}</prayer_requests>\n    <info>${escapeXml(input.info ?? "")}</info>\n    <email_notification>${escapeXml(input.emailNotification ?? "none")}</email_notification>\n  </event>\n</events>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
