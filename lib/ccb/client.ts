import "server-only";

import { XMLParser } from "fast-xml-parser";
import { buildEventAttendanceXml } from "@/lib/ccb/attendance-xml";
import { getServerEnv } from "@/lib/env";
import {
  CcbClientError,
  CcbDeletionBlockedError,
  type AddIndividualToGroupInput,
  type CcbAttendanceProfile,
  type CcbAttendanceProfileInput,
  type CcbEvent,
  type CcbEventProfileInput,
  type CcbGroup,
  type CcbGroupParticipantsInput,
  type CcbGroupProfileInput,
  type CcbIndividual,
  type CcbIndividualProfileInput,
  type CcbIndividualSearchInput,
  type CcbRawResponse,
  type CcbRequestOptions,
  type CreateEventAttendanceInput,
  type CreateEventInput,
  type CreateGroupInput,
  type CreateIndividualInput,
  type DeleteEventInput,
  type DeleteGroupInput,
  type InactivateGroupInput,
  type UpdateIndividualInput,
  type UpdateGroupInput
} from "@/lib/ccb/types";
import {
  normalizeAttendanceProfile,
  normalizeEvents,
  normalizeGroups,
  normalizeIndividuals
} from "@/lib/ccb/normalizers";
import { asRecord, firstText } from "@/lib/ccb/xml";

const EXPLICITLY_DESTRUCTIVE_SERVICES = new Set([
  "remove_individual_from_group",
  "individual_inactivate"
]);

export class CcbClient {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: true,
    processEntities: false
  });

  async requestRaw(options: CcbRequestOptions): Promise<string> {
    const response = await this.request(options);
    return response.xml;
  }

  async requestParsed(options: CcbRequestOptions): Promise<unknown> {
    const response = await this.request(options);
    return response.parsed;
  }

  async request(options: CcbRequestOptions): Promise<CcbRawResponse> {
    if (isDestructiveService(options.service) && !options.allowDestructive) {
      throw new CcbDeletionBlockedError(options.service);
    }

    const env = getServerEnv();
    const url = new URL(env.CCB_API_URL);
    url.searchParams.set("srv", options.service);

    appendParams(url.searchParams, options.queryParams, options.includeEmptyParams);

    const method = options.method ?? "GET";
    let body: BodyInit | undefined;
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${env.CCB_API_USERNAME}:${env.CCB_API_PASSWORD}`).toString("base64")}`,
      Accept: "application/xml,text/xml,*/*"
    };

    if (options.multipartFile) {
      const form = new FormData();
      appendFormData(form, options.params, options.includeEmptyParams);
      form.append(
        options.multipartFile.fieldName,
        new Blob([options.multipartFile.content], {
          type: options.multipartFile.contentType ?? "application/xml"
        }),
        options.multipartFile.filename
      );
      body = form;
    } else if (method === "POST") {
      const form = new URLSearchParams();
      appendParams(form, options.params, options.includeEmptyParams);
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = form.toString();
    } else {
      appendParams(url.searchParams, options.params, options.includeEmptyParams);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        cache: "no-store",
        signal: controller.signal
      });

      const xml = await response.text();

      if (!response.ok) {
        throw new CcbClientError(
          `CCB request failed with HTTP ${response.status}.`,
          response.status,
          options.service,
          xml.slice(0, 2000)
        );
      }

      const parsed = this.parser.parse(xml);
      const apiError = extractCcbError(parsed);

      if (apiError) {
        throw new CcbClientError(apiError, response.status, options.service, xml.slice(0, 2000));
      }

      return {
        service: options.service,
        url: redactUrl(url),
        xml,
        parsed
      };
    } catch (error) {
      if (error instanceof CcbClientError) throw error;

      if (error instanceof Error && error.name === "AbortError") {
        throw new CcbClientError(
          `CCB request timed out after ${options.timeoutMs ?? 30000}ms.`,
          undefined,
          options.service
        );
      }

      throw new CcbClientError(
        error instanceof Error ? error.message : "Unknown CCB request error.",
        undefined,
        options.service
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async describe(service: string): Promise<unknown> {
    return this.requestParsed({ service, params: { describe_api: 1 } });
  }

  async searchIndividuals(input: CcbIndividualSearchInput): Promise<CcbIndividual[]> {
    const parsed = await this.requestParsed({
      service: "individual_search",
      params: {
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
        email: input.email
      }
    });
    return normalizeIndividuals(parsed);
  }

  async getIndividualProfile(input: CcbIndividualProfileInput): Promise<CcbIndividual | null> {
    const parsed = await this.requestParsed({
      service: "individual_profile_from_id",
      params: { individual_id: input.individualId }
    });
    return normalizeIndividuals(parsed)[0] ?? null;
  }

  async listDuplicateIndividuals(
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<CcbIndividual[]> {
    const parsed = await this.requestParsed({
      service: "duplicate_individuals_list",
      params
    });
    return normalizeIndividuals(parsed);
  }

  async listGroups(
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<CcbGroup[]> {
    if (params.page || params.per_page) {
      const parsed = await this.requestParsed({
        service: "group_profiles",
        params: { include_participants: false, include_image_link: false, ...params },
        timeoutMs: 45000
      });
      return normalizeGroups(parsed);
    }

    return this.paginate<CcbGroup>(
      "group_profiles",
      { include_participants: false, include_image_link: false, ...params },
      normalizeGroups
    );
  }

  async getGroupProfile(input: CcbGroupProfileInput): Promise<CcbGroup | null> {
    const parsed = await this.requestParsed({
      service: "group_profile_from_id",
      params: {
        id: input.groupId,
        include_participants: false,
        include_image_link: input.includeImageLink ?? false
      },
      timeoutMs: 45000
    });
    return normalizeGroups(parsed)[0] ?? null;
  }

  async listGroupParticipants(input: CcbGroupParticipantsInput): Promise<CcbIndividual[]> {
    const parsed = await this.requestParsed({
      service: "group_participants",
      params: { id: input.groupId },
      timeoutMs: 45000
    });
    return normalizeIndividuals(parsed);
  }

  async listIndividualGroups(input: CcbIndividualProfileInput): Promise<CcbGroup[]> {
    const parsed = await this.requestParsed({
      service: "individual_groups",
      params: { individual: input.individualId }
    });
    return normalizeGroups(parsed);
  }

  async listEvents(
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<CcbEvent[]> {
    if (params.page || params.per_page) {
      const parsed = await this.requestParsed({
        service: "event_profiles",
        params: { include_guest_list: false, include_image_link: false, ...params },
        timeoutMs: 45000
      });
      return normalizeEvents(parsed);
    }

    return this.paginate<CcbEvent>(
      "event_profiles",
      { include_guest_list: false, include_image_link: false, ...params },
      normalizeEvents
    );
  }

  async getEventProfile(input: CcbEventProfileInput): Promise<CcbEvent | null> {
    const parsed = await this.requestParsed({
      service: "event_profile",
      params: { id: input.eventId, include_guest_list: false, include_image_link: false }
    });
    return normalizeEvents(parsed)[0] ?? null;
  }

  async getAttendanceProfile(input: CcbAttendanceProfileInput): Promise<CcbAttendanceProfile> {
    const parsed = await this.requestParsed({
      service: "attendance_profile",
      params: { id: input.eventId, occurrence: input.occurrence }
    });
    return normalizeAttendanceProfile(parsed);
  }

  async listAttendanceProfiles(input: { startDate: string; endDate: string }) {
    const parsed = await this.requestParsed({
      service: "attendance_profiles",
      params: { start_date: input.startDate, end_date: input.endDate },
      timeoutMs: 45000
    });
    return normalizeAttendanceProfile(parsed);
  }

  async createEvent(input: CreateEventInput): Promise<CcbEvent | unknown> {
    const parsed = await this.requestParsed({
      service: "create_event",
      method: "POST",
      params: {
        group_id: input.groupId,
        start_date: input.startDate,
        end_date: input.endDate,
        name: input.name,
        description: input.description,
        leader_notes: input.leaderNotes,
        organizer_id: input.organizerId,
        contact_phone: input.contactPhone,
        event_type_id: input.eventTypeId,
        registration_form_id: input.registrationFormId,
        event_grouping_id: input.eventGroupingId,
        registration_limit: input.registrationLimit,
        recurrence_type: input.recurrenceType,
        recurrence_frequency: input.recurrenceFrequency,
        recurrence_week_number: input.recurrenceWeekNumber,
        recurrence_day_of_week: input.recurrenceDayOfWeek,
        recurrence_day_of_month: input.recurrenceDayOfMonth,
        recurrence_end_date: input.recurrenceEndDate,
        number_of_occurrences: input.numberOfOccurrences,
        location_name: input.locationName,
        location_street_address: input.locationStreetAddress,
        location_city: input.locationCity,
        location_state: input.locationState?.toUpperCase(),
        location_zip: input.locationZip,
        notification: toCcbBoolean(input.notification),
        attendance_reminder: toCcbBoolean(input.attendanceReminder),
        uses_resources: toCcbBoolean(input.usesResources),
        use_campus_address: toCcbBoolean(input.useCampusAddress),
        listed: toCcbBoolean(input.listed),
        creator_id: input.creatorId
      },
      timeoutMs: 45000
    });
    return normalizeEvents(parsed)[0] ?? parsed;
  }

  async createEventAttendance(input: CreateEventAttendanceInput) {
    const xml = buildEventAttendanceXml(input);
    const parsed = await this.requestParsed({
      service: "create_event_attendance",
      method: "POST",
      multipartFile: {
        fieldName: "filedata",
        filename: "create_event_attendance.xml",
        content: xml,
        contentType: "application/xml"
      },
      timeoutMs: 45000
    });
    return normalizeAttendanceProfile(parsed);
  }

  async createIndividual(input: CreateIndividualInput): Promise<CcbIndividual | unknown> {
    const parsed = await this.requestParsed({
      service: "create_individual",
      method: "POST",
      params: {
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        mobile_phone: input.mobilePhone,
        campus_id: input.campusId,
        family_position: input.familyPosition,
        limited_access_user:
          input.limitedAccessUser === undefined ? undefined : input.limitedAccessUser ? 1 : 0
      }
    });
    return normalizeIndividuals(parsed)[0] ?? parsed;
  }

  async updateIndividual(input: UpdateIndividualInput): Promise<CcbIndividual | unknown> {
    const parsed = await this.requestParsed({
      service: "update_individual",
      method: "POST",
      queryParams: { individual_id: input.individualId },
      params: {
        email: input.email,
        mobile_phone: input.mobilePhone,
        home_phone: input.homePhone
      }
    });
    return normalizeIndividuals(parsed)[0] ?? parsed;
  }

  async createGroup(input: CreateGroupInput): Promise<CcbGroup | unknown> {
    const parsed = await this.requestParsed({
      service: "create_group",
      params: groupParams(input)
    });
    return normalizeGroups(parsed)[0] ?? parsed;
  }

  async updateGroup(input: UpdateGroupInput): Promise<CcbGroup | unknown> {
    if (input.inactive === true) {
      throw new CcbDeletionBlockedError("update_group(inactive=true)");
    }

    const parsed = await this.requestParsed({
      service: "update_group",
      method: "POST",
      queryParams: { id: input.id },
      includeEmptyParams: true,
      params: {
        ...groupParams(input),
        notification: input.notification,
        inactive: input.inactive,
        modifier_id: input.modifierId,
        owner_id: input.ownerId,
        director_id: input.directorId,
        coach_id: input.coachId
      }
    });
    return normalizeGroups(parsed)[0] ?? parsed;
  }

  /**
   * Soft-delete/archive a CCB group by marking it inactive. This is the only
   * documented group-removal style operation exposed by the public CCB API.
   * Call this only after app-created validation has already passed.
   */
  async inactivateGroup(input: InactivateGroupInput): Promise<CcbGroup | unknown> {
    const parsed = await this.requestParsed({
      service: "update_group",
      method: "POST",
      queryParams: { id: input.groupId },
      includeEmptyParams: true,
      allowDestructive: true,
      params: { inactive: 1 }
    });
    return normalizeGroups(parsed)[0] ?? parsed;
  }

  /**
   * Attempt a true CCB group delete. This service is not documented in the
   * public Pushpay/CCB API, so callers must treat failures as expected and
   * fall back to inactivation when unsupported.
   */
  async deleteGroupIfServiceExists(input: DeleteGroupInput): Promise<unknown> {
    return this.requestParsed({
      service: "delete_group",
      allowDestructive: true,
      params: { id: input.groupId }
    });
  }

  /**
   * Attempt a true CCB event delete. This service is not documented in the
   * public Pushpay/CCB API. It is only attempted for events proven to have been
   * created by this app.
   */
  async deleteEventIfServiceExists(input: DeleteEventInput): Promise<unknown> {
    return this.requestParsed({
      service: "delete_event",
      allowDestructive: true,
      params: { id: input.eventId }
    });
  }

  async addIndividualToGroup(input: AddIndividualToGroupInput) {
    return this.requestParsed({
      service: "add_individual_to_group",
      params: {
        id: input.individualId,
        group_id: input.groupId,
        status: input.status ?? "add"
      }
    });
  }

  private async paginate<T>(
    service: string,
    baseParams: Record<string, string | number | boolean | undefined>,
    normalize: (parsed: unknown) => T[]
  ): Promise<T[]> {
    const perPage = 100;
    const results: T[] = [];

    for (let page = 1; page <= 100; page += 1) {
      const parsed = await this.requestParsed({
        service,
        params: { ...baseParams, page, per_page: perPage },
        timeoutMs: 45000
      });
      const pageResults = normalize(parsed);
      results.push(...pageResults);
      if (pageResults.length < perPage) break;
    }

    return results;
  }
}

function toCcbBoolean(value: boolean | undefined) {
  if (value === undefined) return undefined;
  return value ? 1 : 0;
}

function groupParams(input: CreateGroupInput | UpdateGroupInput) {
  return {
    name: input.name,
    campus_id: input.campusId,
    main_leader_id: "mainLeaderId" in input ? input.mainLeaderId : undefined,
    description: input.description,
    group_type_id: input.groupTypeId,
    department_id: input.departmentId,
    area_id: input.areaId,
    group_capacity: input.groupCapacity,
    meeting_location_street_address: input.meetingLocationStreetAddress,
    meeting_location_city: input.meetingLocationCity,
    meeting_location_state: input.meetingLocationState?.toUpperCase(),
    meeting_location_zip: input.meetingLocationZip,
    meeting_day_id: input.meetingDayId,
    meeting_time_id: input.meetingTimeId,
    childcare_provided: input.childcareProvided,
    interaction_type: input.interactionType,
    membership_type:
      "id" in input && input.membershipType === "Invitation or Request Required"
        ? undefined
        : input.membershipType,
    listed: input.listed,
    public_search_listed: input.publicSearchListed,
    udf_group_pulldown_1_id: input.udfGroupPulldown1Id,
    udf_group_pulldown_2_id: input.udfGroupPulldown2Id,
    udf_group_pulldown_3_id: input.udfGroupPulldown3Id
  };
}

function isDestructiveService(service: string) {
  const normalized = service.toLowerCase();
  return (
    EXPLICITLY_DESTRUCTIVE_SERVICES.has(normalized) ||
    normalized.startsWith("delete_") ||
    normalized.startsWith("remove_") ||
    normalized.includes("_delete") ||
    normalized.includes("_remove") ||
    normalized.includes("inactivate") ||
    normalized.includes("deactivate")
  );
}

function appendParams(
  target: URLSearchParams,
  params?: Record<string, string | number | boolean | null | undefined>,
  includeEmpty = false
) {
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined) continue;
    if (!includeEmpty && String(value).length === 0) continue;
    target.set(key, String(value));
  }
}

function appendFormData(
  target: FormData,
  params?: Record<string, string | number | boolean | null | undefined>,
  includeEmpty = false
) {
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined) continue;
    if (!includeEmpty && String(value).length === 0) continue;
    target.append(key, String(value));
  }
}

function extractCcbError(parsed: unknown) {
  const root = asRecord(parsed);
  const ccb = asRecord(root?.ccb_api) ?? root;
  const response = asRecord(ccb?.response);
  const errors = asRecord(response?.errors) ?? asRecord(ccb?.errors);
  const error = asRecord(errors?.error) ?? asRecord(response?.error) ?? asRecord(ccb?.error);

  return firstText(error, ["message", "description", "#text"]) ?? firstText(errors, ["error"]);
}

function redactUrl(url: URL) {
  const clone = new URL(url.toString());
  for (const key of ["password", "pass", "api_password"]) {
    if (clone.searchParams.has(key)) clone.searchParams.set(key, "[REDACTED]");
  }
  return clone.toString();
}

export function createCcbClient() {
  return new CcbClient();
}
