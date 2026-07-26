import "server-only";

import { unstable_cache } from "next/cache";
import { resolveCcbOccurrence } from "@/lib/attendance/occurrence";
import {
  buildPublicPresentRoster,
  isPresentCheckinStatus,
  sanitizeAttendanceName,
  type PresentRosterCandidate,
  type PublicPresentAttendee
} from "@/lib/attendance/present-roster-view";
import { createCcbClient } from "@/lib/ccb/client";
import { getEnabledClassDisplayMapping } from "@/lib/checkin/class-display";
import { getInternalCheckinSessionByClassSlug } from "@/lib/checkin/class-link";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type LocalCheckinRow = {
  ccb_individual_id: string | null;
  status: string;
  metadata: unknown;
};

type SessionOccurrenceRow = {
  occurrence_date: string;
  occurrence_start_at: string | null;
  options: unknown;
};

type CachedCcbAttendee = {
  id: string;
  name: string | null;
};

export type PresentRosterResponse = {
  state: "open" | "no_active_meeting";
  attendees: PublicPresentAttendee[];
  count: number;
  updatedAt: string;
  partial?: boolean;
  message?: string;
};

const getCachedCcbAttendance = unstable_cache(
  async (eventId: string, occurrence: string) => {
    const profile = await createCcbClient().getAttendanceProfile({
      eventId,
      occurrence
    });
    return profile.attendees.map(
      (attendee): CachedCcbAttendee => ({
        id: attendee.id,
        name: sanitizeAttendanceName(attendee.name)
      })
    );
  },
  ["teacher-present-roster-ccb-v1"],
  { revalidate: 30 }
);

const getCachedCcbIndividualName = unstable_cache(
  async (individualId: string) => {
    const person = await createCcbClient().getIndividualProfile({
      individualId
    });
    return sanitizeAttendanceName(
      person?.fullName ??
        [person?.firstName, person?.lastName].filter(Boolean).join(" ")
    );
  },
  ["teacher-present-roster-person-v1"],
  { revalidate: 21_600 }
);

export async function getPresentRoster(
  presentationToken: string
): Promise<PresentRosterResponse | null> {
  const mapping = await getEnabledClassDisplayMapping(presentationToken);
  if (!mapping) return null;

  const sessionResult = await getInternalCheckinSessionByClassSlug(
    mapping.public_checkin_slug
  );
  if (!sessionResult.ok) {
    return {
      state: "no_active_meeting",
      attendees: [],
      count: 0,
      updatedAt: new Date().toISOString(),
      message: sessionResult.message
    };
  }

  const supabase = createSupabaseAdminClient();
  const session = sessionResult.session;
  const [{ data: occurrenceRow, error: occurrenceError }, localResult] =
    await Promise.all([
      supabase
        .from("checkin_sessions")
        .select("occurrence_date,occurrence_start_at,options")
        .eq("id", session.id)
        .single(),
      supabase
        .from("attendance_checkins")
        .select("ccb_individual_id,status,metadata")
        .eq("session_id", session.id)
        .not("ccb_individual_id", "is", null)
    ]);

  if (occurrenceError || !occurrenceRow) {
    throw new Error(
      occurrenceError?.message ?? "The active meeting could not be loaded."
    );
  }
  if (localResult.error) throw new Error(localResult.error.message);

  const localRows = ((localResult.data ?? []) as LocalCheckinRow[]).filter(
    (row) =>
      Boolean(row.ccb_individual_id) && isPresentCheckinStatus(row.status)
  );
  const occurrence = resolveCcbOccurrence(
    occurrenceRow as SessionOccurrenceRow
  );

  let ccbAttendees: CachedCcbAttendee[] = [];
  let partial = false;
  try {
    ccbAttendees = await getCachedCcbAttendance(
      session.ccbEventId,
      occurrence
    );
  } catch {
    partial = true;
  }

  const ccbIds = new Set(ccbAttendees.map((attendee) => attendee.id));
  const candidates: PresentRosterCandidate[] = ccbAttendees.map(
    (attendee) => ({
      ccbIndividualId: attendee.id,
      name: attendee.name,
      nameSource: "ccb",
      isLeader: attendee.id === mapping.ccb_main_leader_id
    })
  );
  const profileIds = new Set<string>();

  for (const row of localRows) {
    const individualId = row.ccb_individual_id?.trim();
    if (!individualId) continue;

    const metadata = asObject(row.metadata);
    const metadataName = sanitizeAttendanceName(
      typeof metadata.display_name === "string"
        ? metadata.display_name
        : null
    );
    const isLeader =
      individualId === mapping.ccb_main_leader_id ||
      metadata.attendance_role === "leader";

    candidates.push({
      ccbIndividualId: individualId,
      name: metadataName,
      nameSource: metadataName ? "metadata" : "placeholder",
      isLeader
    });

    if (!ccbIds.has(individualId)) profileIds.add(individualId);
  }

  for (const attendee of ccbAttendees) {
    if (!attendee.name) profileIds.add(attendee.id);
  }

  const allProfileIds = [...profileIds];
  const lookupProfileIds = partial ? [] : allProfileIds.slice(0, 8);
  const profileResults = partial
    ? []
    : await Promise.allSettled(
        lookupProfileIds.map(async (individualId) => ({
          individualId,
          name: await getCachedCcbIndividualName(individualId)
        }))
      );
  const resolvedProfileIds = new Set<string>();

  for (const result of profileResults) {
    if (result.status !== "fulfilled" || !result.value.name) {
      partial = true;
      continue;
    }
    resolvedProfileIds.add(result.value.individualId);
    candidates.push({
      ccbIndividualId: result.value.individualId,
      name: result.value.name,
      nameSource: "profile",
      isLeader: result.value.individualId === mapping.ccb_main_leader_id
    });
  }

  for (const individualId of allProfileIds) {
    if (resolvedProfileIds.has(individualId)) continue;
    partial = true;
    candidates.push({
      ccbIndividualId: individualId,
      name: "Present participant",
      nameSource: "profile",
      isLeader: individualId === mapping.ccb_main_leader_id
    });
  }

  const attendees = buildPublicPresentRoster(
    session.id,
    candidates,
    getServerEnv().SUPABASE_SERVICE_ROLE_KEY
  );
  return {
    state: "open",
    attendees,
    count: attendees.length,
    updatedAt: new Date().toISOString(),
    ...(partial ? { partial: true } : {})
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
