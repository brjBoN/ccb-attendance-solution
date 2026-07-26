import "server-only";

import { createCcbClient } from "@/lib/ccb/client";
import {
  eventIdCandidatesFromUid,
  parseCcbGroupCalendar
} from "@/lib/ccb/group-calendar";
import type { CcbEvent, CcbGroup } from "@/lib/ccb/types";
import { CcbClientError } from "@/lib/ccb/types";
import { asRecord, firstText } from "@/lib/ccb/xml";
import { getServerEnv } from "@/lib/env";

export type ExistingGroupEvent = {
  id: string;
  name: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  recurrence: string | null;
  groupId: string;
  eventGroupingId: string | null;
  eventGroupingName: string | null;
  timeZone: string | null;
  listed: boolean | null;
};

export class GroupEventDetectionUnavailableError extends Error {
  constructor(message = "CCB could not safely verify this group's existing attendance events.") {
    super(message);
    this.name = "GroupEventDetectionUnavailableError";
  }
}

const MAX_EVENT_PROFILE_LOOKUPS = 8;

export async function findExistingGroupEvents(groupId: string) {
  const client = createCcbClient();
  const group = await client.getGroupProfile({ groupId });
  if (!group) return null;
  const safeGroup = {
    id: group.id,
    name: group.name,
    mainLeaderId: group.mainLeaderId
  };

  const calendarUrl = readValidatedCalendarUrl(group);
  if (!calendarUrl) {
    throw new GroupEventDetectionUnavailableError(
      "CCB did not provide a verifiable calendar for this group. Nothing was changed."
    );
  }

  const calendar = await fetchGroupCalendar(calendarUrl);
  const upperCalendar = calendar.toUpperCase();
  if (
    !upperCalendar.includes("BEGIN:VCALENDAR") ||
    !upperCalendar.includes("END:VCALENDAR")
  ) {
    throw new GroupEventDetectionUnavailableError(
      "CCB returned an invalid group calendar. Nothing was changed."
    );
  }
  const references = parseCcbGroupCalendar(calendar);
  const rawEventCount = upperCalendar.match(/BEGIN:VEVENT/g)?.length ?? 0;
  if (references.length !== rawEventCount) {
    throw new GroupEventDetectionUnavailableError(
      "CCB returned calendar events that could not be verified safely. Nothing was changed."
    );
  }
  const attemptedIds = new Set<string>();
  const events = new Map<string, ExistingGroupEvent>();
  let profileLookups = 0;

  for (const reference of references) {
    for (const eventId of eventIdCandidatesFromUid(reference.uid)) {
      if (attemptedIds.has(eventId)) continue;
      if (profileLookups >= MAX_EVENT_PROFILE_LOOKUPS) {
        throw new GroupEventDetectionUnavailableError(
          "This group calendar has too many event records to verify safely. Nothing was changed."
        );
      }
      attemptedIds.add(eventId);
      profileLookups += 1;

      let event: CcbEvent | null;
      try {
        event = await client.getEventProfile({ eventId });
      } catch (error) {
        if (error instanceof CcbClientError && [400, 404].includes(error.status ?? 0)) {
          continue;
        }
        throw error;
      }

      if (!event || event.groupId !== group.id) continue;
      events.set(event.id, toExistingGroupEvent(event, group.id));
      break;
    }
  }

  if (references.length > 0 && events.size === 0) {
    throw new GroupEventDetectionUnavailableError(
      "CCB returned calendar events that could not be verified safely. Nothing was changed."
    );
  }

  return { group: safeGroup, events: [...events.values()] };
}

function readValidatedCalendarUrl(group: CcbGroup) {
  const raw = asRecord(group.raw);
  const encoded = firstText(raw, ["calendar_feed", "calendar_url"]);
  if (!encoded) return null;

  const decoded = decodeXmlUrl(encoded);
  const apiUrl = new URL(getServerEnv().CCB_API_URL);
  let calendarUrl: URL;

  try {
    calendarUrl = new URL(
      decoded.replace(/^webcal:/i, "https:"),
      apiUrl.origin
    );
  } catch {
    return null;
  }

  const allowedPath = calendarUrl.pathname.toLowerCase().endsWith("/group_calendar.ics");
  if (
    calendarUrl.protocol !== "https:" ||
    calendarUrl.host.toLowerCase() !== apiUrl.host.toLowerCase() ||
    !allowedPath ||
    calendarUrl.username ||
    calendarUrl.password
  ) {
    return null;
  }

  return calendarUrl;
}

async function fetchGroupCalendar(calendarUrl: URL) {
  const response = await fetch(calendarUrl, {
    cache: "no-store",
    redirect: "error",
    headers: { Accept: "text/calendar" },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`CCB group calendar returned HTTP ${response.status}.`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) {
    throw new Error("CCB group calendar was unexpectedly large.");
  }

  const text = await response.text();
  if (text.length > 1_000_000) {
    throw new Error("CCB group calendar was unexpectedly large.");
  }
  return text;
}

function toExistingGroupEvent(event: CcbEvent, groupId: string): ExistingGroupEvent {
  return {
    id: event.id,
    name: event.name,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    recurrence: event.recurrence,
    groupId,
    eventGroupingId: event.eventGroupingId,
    eventGroupingName: event.eventGroupingName,
    timeZone: event.timeZone,
    listed: event.listed
  };
}

function decodeXmlUrl(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/g, "&")
    .trim();
}
