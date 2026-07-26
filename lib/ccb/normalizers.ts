import type {
  CcbAttendancePerson,
  CcbAttendanceProfile,
  CcbEvent,
  CcbGroup,
  CcbIndividual
} from "@/lib/ccb/types";
import {
  asRecord,
  attrValue,
  ccbResponse,
  firstArray,
  firstRecord,
  firstText,
  textValue
} from "@/lib/ccb/xml";

export function normalizeIndividuals(parsed: unknown): CcbIndividual[] {
  const response = ccbResponse(parsed);
  const candidates = firstArray(firstRecord(response, ["individuals", "duplicate_individuals"]), ["individual"]);
  const direct = firstArray(response, ["individual"]);

  return [...candidates, ...direct]
    .map(normalizeIndividual)
    .filter((person): person is CcbIndividual => Boolean(person?.id));
}

export function normalizeIndividual(value: unknown): CcbIndividual | null {
  const record = asRecord(value);
  if (!record) return null;

  const phones = collectPhones(record);
  const campusRecord = asRecord(record.campus);
  const id = attrValue(record, "id") ?? firstText(record, ["id", "individual_id", "ccb_individual_id"]);
  if (!id) return null;

  return {
    id,
    firstName: firstText(record, ["first_name", "firstName", "given_name"]),
    lastName: firstText(record, ["last_name", "lastName", "family_name"]),
    fullName: firstText(record, ["full_name", "fullName", "name"]),
    email: firstText(record, ["email", "email_address", "primary_email"]),
    mobilePhone: phones.mobile ?? firstText(record, ["mobile_phone", "mobile", "cell_phone"]),
    homePhone: phones.home ?? firstText(record, ["home_phone", "phone"]),
    campus: nestedName(record, ["campus", "campus_name"]),
    campusId: attrValue(campusRecord, "id"),
    status: nestedName(record, ["status", "membership_status", "active"]),
    raw: value
  };
}

export function normalizeGroups(parsed: unknown): CcbGroup[] {
  const response = ccbResponse(parsed);
  const candidates = firstArray(firstRecord(response, ["groups"]), ["group"]);
  const direct = firstArray(response, ["group"]);

  return [...candidates, ...direct]
    .map(normalizeGroup)
    .filter((group): group is CcbGroup => Boolean(group?.id));
}

export function normalizeGroup(value: unknown): CcbGroup | null {
  const record = asRecord(value);
  if (!record) return null;

  const id = attrValue(record, "id") ?? firstText(record, ["id", "group_id"]);
  if (!id) return null;

  const campus = asRecord(record.campus);
  const leader = firstRecord(record, ["main_leader", "leader", "primary_leader"]);
  const groupType = asRecord(record.group_type);
  const department = asRecord(record.department);
  const area = asRecord(record.area);
  const meetingDay = asRecord(record.meeting_day);
  const meetingTime = asRecord(record.meeting_time);
  const addresses = firstRecord(record, ["addresses"]);
  const addressValues = firstArray(addresses, ["address"]);
  const meetingAddress =
    addressValues.map(asRecord).find((address) => attrValue(address, "type") === "meeting") ??
    addressValues.map(asRecord).find(Boolean) ??
    null;

  return {
    id,
    name: decodeCcbText(firstText(record, ["name", "group_name", "title"])),
    description: firstText(record, ["description", "desc"]),
    groupType: nestedName(record, ["group_type", "type"]),
    groupTypeId: attrValue(groupType, "id"),
    campus: nestedName(record, ["campus", "campus_name"]),
    campusId: attrValue(campus, "id"),
    leaderName: nestedName(record, ["main_leader", "leader", "primary_leader"]),
    mainLeaderId: attrValue(leader, "id"),
    department: nestedName(record, ["department"]),
    departmentId: attrValue(department, "id"),
    area: nestedName(record, ["area"]),
    areaId: attrValue(area, "id"),
    capacity: firstText(record, ["group_capacity", "capacity"]),
    meetingDay: nestedName(record, ["meeting_day"]),
    meetingDayId: attrValue(meetingDay, "id"),
    meetingTime: nestedName(record, ["meeting_time"]),
    meetingTimeId: attrValue(meetingTime, "id"),
    childcareProvided: booleanValue(record.childcare_provided),
    interactionType: firstText(record, ["interaction_type"]),
    membershipType: firstText(record, ["membership_type"]),
    listed: booleanValue(record.listed),
    publicSearchListed: booleanValue(record.public_search_listed),
    notification: booleanValue(record.notification),
    meetingLocationStreetAddress: firstText(meetingAddress, ["street_address", "line_1"]),
    meetingLocationCity: firstText(meetingAddress, ["city"]),
    meetingLocationState: firstText(meetingAddress, ["state"]),
    meetingLocationZip: firstText(meetingAddress, ["zip", "postal_code"]),
    inactive: booleanValue(record.inactive),
    raw: value
  };
}

export function normalizeEvents(parsed: unknown): CcbEvent[] {
  const response = ccbResponse(parsed);
  const candidates = firstArray(firstRecord(response, ["events"]), ["event"]);
  const direct = firstArray(response, ["event"]);

  return [...candidates, ...direct]
    .map(normalizeEvent)
    .filter((event): event is CcbEvent => Boolean(event?.id));
}

export function normalizeEvent(value: unknown): CcbEvent | null {
  const record = asRecord(value);
  if (!record) return null;

  const id = attrValue(record, "id") ?? firstText(record, ["id", "event_id"]);
  if (!id) return null;
  const eventGrouping = firstRecord(record, ["event_grouping", "attendance_grouping"]);

  return {
    id,
    name: decodeCcbText(firstText(record, ["name", "event_name", "title"])),
    description: firstText(record, ["description", "desc"]),
    startDateTime: firstText(record, ["start_datetime", "start_date_time", "starts_at", "start"]),
    endDateTime: firstText(record, ["end_datetime", "end_date_time", "ends_at", "end"]),
    recurrence: firstText(record, ["recurrence", "recurrence_description", "schedule"]),
    groupId: attrValue(asRecord(record.group), "id") ?? firstText(record, ["group_id", "ccb_group_id"]),
    eventGroupingId:
      attrValue(eventGrouping, "id") ??
      firstText(record, ["event_grouping_id", "attendance_grouping_id"]),
    eventGroupingName: decodeCcbText(textValue(eventGrouping)),
    timeZone: firstText(record, ["timezone", "time_zone"]),
    listed: booleanValue(record.listed),
    raw: value
  };
}

function decodeCcbText(value: string | null) {
  if (!value) return value;
  return value
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

export function normalizeAttendanceProfile(parsed: unknown): CcbAttendanceProfile {
  const response = ccbResponse(parsed);
  const events = firstRecord(response, ["events"]);
  const actualEvent = firstRecord(events, ["event"]) ?? firstRecord(response, ["event"]);
  const legacyAttendance = firstRecord(response, ["attendance", "attendance_profile"]);
  const source = actualEvent ?? legacyAttendance;

  if (!source) {
    return {
      id: null,
      eventId: null,
      occurrenceDate: null,
      didNotMeet: null,
      headCount: null,
      topic: null,
      notes: null,
      prayerRequests: null,
      info: null,
      attendees: [],
      raw: parsed
    };
  }

  const attendeesContainer = firstRecord(source, ["attendees"]);
  const attendeeValues = firstArray(attendeesContainer, ["attendee"]);
  const attendees = attendeeValues
    .map(normalizeAttendancePerson)
    .filter((person): person is CcbAttendancePerson => Boolean(person?.id));

  const nestedEvent = firstRecord(source, ["event"]);
  const actualEventId = actualEvent ? attrValue(actualEvent, "id") : null;
  const legacyEventId = attrValue(nestedEvent, "id") ?? firstText(source, ["event_id"]);
  const eventId = actualEventId ?? legacyEventId;
  const recordId = legacyAttendance ? attrValue(legacyAttendance, "id") : eventId;

  return {
    id: recordId,
    eventId,
    occurrenceDate: firstText(source, ["occurrence", "occurrence_date", "date"]),
    didNotMeet: booleanValue(source.did_not_meet),
    headCount: numberValue(source.head_count),
    topic: firstText(source, ["topic"]),
    notes: firstText(source, ["notes"]),
    prayerRequests: firstText(source, ["prayer_requests"]),
    info: firstText(source, ["info"]),
    attendees,
    raw: parsed
  };
}

export function normalizeAttendancePerson(value: unknown): CcbAttendancePerson | null {
  const record = asRecord(value);
  if (!record) return null;

  const individual = firstRecord(record, ["individual", "person", "profile"]);
  const source = individual ?? record;
  const id = attrValue(source, "id") ?? firstText(source, ["id", "individual_id"]);
  if (!id) return null;

  const firstName = firstText(source, ["first_name"]);
  const lastName = firstText(source, ["last_name"]);
  const composedName = [firstName, lastName].filter(Boolean).join(" ") || null;

  return {
    id,
    name: firstText(source, ["full_name", "fullName", "name"]) ?? composedName,
    status: firstText(record, ["status", "attendance_status"]),
    raw: value
  };
}

function nestedName(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const direct = textValue(record[key]);
    if (direct) return direct;

    const nested = asRecord(record[key]);
    if (nested) {
      const nestedText = firstText(nested, ["name", "title", "label", "full_name"]);
      if (nestedText) return nestedText;
    }
  }
  return null;
}

function collectPhones(record: Record<string, unknown>) {
  const result: { mobile?: string; home?: string } = {};
  const phones = firstRecord(record, ["phones", "phone_numbers"]);
  const phoneValues = [...firstArray(phones, ["phone"]), ...firstArray(record, ["phone"])];

  for (const phone of phoneValues) {
    const phoneRecord = asRecord(phone);
    const phoneText = textValue(phone);
    if (!phoneText) continue;

    const type = attrValue(phoneRecord, "type") ?? firstText(phoneRecord, ["type", "label"]) ?? "";
    if (/mobile|cell/i.test(type)) result.mobile = result.mobile ?? phoneText;
    if (/home/i.test(type)) result.home = result.home ?? phoneText;
  }
  return result;
}

function booleanValue(value: unknown): boolean | null {
  const text = textValue(value)?.toLowerCase();
  if (text === "true" || text === "1" || text === "yes") return true;
  if (text === "false" || text === "0" || text === "no") return false;
  return null;
}

function numberValue(value: unknown): number | null {
  const text = textValue(value);
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}
