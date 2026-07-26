export type CcbReadServiceName =
  | "individual_search"
  | "individual_profile_from_id"
  | "duplicate_individuals_list"
  | "group_profiles"
  | "group_profile_from_id"
  | "group_participants"
  | "individual_groups"
  | "event_profiles"
  | "event_profile"
  | "attendance_profile"
  | "attendance_profiles";

export type CcbWriteServiceName =
  | "create_event"
  | "create_event_attendance"
  | "create_individual"
  | "update_individual"
  | "add_individual_to_group"
  | "create_group"
  | "update_group"
  | "delete_group"
  | "delete_event";

export type CcbServiceName = CcbReadServiceName | CcbWriteServiceName | string;

export type CcbMultipartFile = {
  fieldName: string;
  filename: string;
  content: string;
  contentType?: string;
};

export type CcbRequestOptions = {
  service: CcbServiceName;
  params?: Record<string, string | number | boolean | null | undefined>;
  queryParams?: Record<string, string | number | boolean | null | undefined>;
  method?: "GET" | "POST";
  multipartFile?: CcbMultipartFile;
  includeEmptyParams?: boolean;
  timeoutMs?: number;
  /**
   * Destructive CCB calls are blocked by default. Only guarded app-created cleanup
   * code should set this, after validating that the target was created by this app.
   */
  allowDestructive?: boolean;
};

export type CcbRawResponse<TParsed = unknown> = {
  service: string;
  url: string;
  xml: string;
  parsed: TParsed;
};

export class CcbClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly service?: string,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = "CcbClientError";
  }
}

export class CcbDeletionBlockedError extends CcbClientError {
  constructor(service: string) {
    super(
      `The CCB service "${service}" is blocked because it deletes, removes, deactivates, or inactivates data.`,
      undefined,
      service
    );
    this.name = "CcbDeletionBlockedError";
  }
}

export type CcbIndividual = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  mobilePhone: string | null;
  homePhone: string | null;
  campus: string | null;
  campusId: string | null;
  status: string | null;
  raw?: unknown;
};

export type CcbIndividualSearchInput = {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
};

export type CcbIndividualProfileInput = {
  individualId: string;
};

export type CcbGroup = {
  id: string;
  name: string | null;
  imageUrl: string | null;
  description: string | null;
  groupType: string | null;
  groupTypeId: string | null;
  campus: string | null;
  campusId: string | null;
  leaderName: string | null;
  mainLeaderId: string | null;
  department: string | null;
  departmentId: string | null;
  area: string | null;
  areaId: string | null;
  capacity: string | null;
  meetingDay: string | null;
  meetingDayId: string | null;
  meetingTime: string | null;
  meetingTimeId: string | null;
  childcareProvided: boolean | null;
  interactionType: string | null;
  membershipType: string | null;
  listed: boolean | null;
  publicSearchListed: boolean | null;
  notification: boolean | null;
  meetingLocationStreetAddress: string | null;
  meetingLocationCity: string | null;
  meetingLocationState: string | null;
  meetingLocationZip: string | null;
  inactive: boolean | null;
  raw?: unknown;
};

export type CcbGroupProfileInput = {
  groupId: string;
  includeImageLink?: boolean;
};

export type CcbGroupParticipantsInput = {
  groupId: string;
};

export type CcbEvent = {
  id: string;
  name: string | null;
  description: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  recurrence: string | null;
  groupId: string | null;
  eventGroupingId: string | null;
  eventGroupingName: string | null;
  timeZone: string | null;
  listed: boolean | null;
  raw?: unknown;
};

export type CcbEventProfileInput = {
  eventId: string;
};

export type CcbAttendanceProfileInput = {
  eventId: string;
  occurrence: string;
};

export type CcbAttendancePerson = {
  id: string;
  name: string | null;
  status: string | null;
  raw?: unknown;
};

export type CcbAttendanceProfile = {
  id: string | null;
  eventId: string | null;
  occurrenceDate: string | null;
  didNotMeet: boolean | null;
  headCount: number | null;
  topic: string | null;
  notes: string | null;
  prayerRequests: string | null;
  info: string | null;
  attendees: CcbAttendancePerson[];
  raw?: unknown;
};

export type CreateEventAttendanceInput = {
  eventId: string;
  occurrence: string;
  individualIds: string[];
  didNotMeet?: boolean;
  headCount?: number;
  topic?: string;
  notes?: string;
  prayerRequests?: string;
  info?: string;
  emailNotification?: "none" | "leaders" | "participants" | "both";
};

export type CreateEventInput = {
  groupId: string;
  startDate: string;
  endDate: string;
  name: string;
  description?: string;
  leaderNotes?: string;
  organizerId?: string;
  contactPhone?: string;
  eventTypeId?: string;
  registrationFormId?: string;
  eventGroupingId?: string;
  registrationLimit?: number;
  recurrenceType?: "daily" | "weekly" | "monthly";
  recurrenceFrequency?: number;
  recurrenceWeekNumber?: "first" | "second" | "third" | "fourth" | "last";
  recurrenceDayOfWeek?: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  recurrenceDayOfMonth?: number;
  recurrenceEndDate?: string;
  numberOfOccurrences?: number;
  locationName?: string;
  locationStreetAddress?: string;
  locationCity?: string;
  locationState?: string;
  locationZip?: string;
  notification?: boolean;
  attendanceReminder?: boolean;
  usesResources?: boolean;
  useCampusAddress?: boolean;
  listed?: boolean;
  creatorId?: string;
};

export type CreateIndividualInput = {
  firstName: string;
  lastName: string;
  email?: string;
  mobilePhone?: string;
  campusId?: string;
  familyPosition?: "h" | "s" | "c" | "o";
  limitedAccessUser?: boolean;
};

export type UpdateIndividualInput = {
  individualId: string;
  email?: string;
  mobilePhone?: string;
  homePhone?: string;
};

export type AddIndividualToGroupInput = {
  individualId: string;
  groupId: string;
  status?: "add" | "invite" | "request";
};
export type InactivateGroupInput = {
  groupId: string;
};

export type DeleteGroupInput = {
  groupId: string;
};

export type DeleteEventInput = {
  eventId: string;
};


export type CreateGroupInput = {
  name: string;
  campusId: string;
  mainLeaderId: string;
  description?: string;
  groupTypeId?: string;
  departmentId?: string;
  areaId?: string;
  groupCapacity?: string;
  meetingLocationStreetAddress?: string;
  meetingLocationCity?: string;
  meetingLocationState?: string;
  meetingLocationZip?: string;
  meetingDayId?: string;
  meetingTimeId?: string;
  childcareProvided?: boolean;
  interactionType?: "Members Interact" | "Announcement Only" | "Administrative";
  membershipType?: "Open to All" | "Invitation or Request Required";
  listed?: boolean;
  publicSearchListed?: boolean;
  udfGroupPulldown1Id?: string;
  udfGroupPulldown2Id?: string;
  udfGroupPulldown3Id?: string;
};

export type UpdateGroupInput = Partial<Omit<CreateGroupInput, "mainLeaderId" | "membershipType">> & {
  id: string;
  membershipType?:
    | "Open to All"
    | "Invitation or Request Required"
    | "Invitation Required"
    | "Request Required";
  notification?: boolean;
  inactive?: boolean;
  modifierId?: string;
  ownerId?: string;
  directorId?: string;
  coachId?: string;
};
