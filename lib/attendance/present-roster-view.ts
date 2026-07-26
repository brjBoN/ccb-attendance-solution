import crypto from "node:crypto";

export const PRESENT_CHECKIN_STATUSES = [
  "success",
  "pending",
  "duplicate"
] as const;

export type PresentNameSource =
  | "placeholder"
  | "metadata"
  | "profile"
  | "ccb";

export type PresentRosterCandidate = {
  ccbIndividualId: string;
  name: string | null;
  nameSource: PresentNameSource;
  isLeader?: boolean;
};

export type PublicPresentAttendee = {
  key: string;
  name: string;
  isLeader: boolean;
};

const NAME_SOURCE_PRIORITY: Record<PresentNameSource, number> = {
  placeholder: 0,
  metadata: 1,
  profile: 2,
  ccb: 3
};

export function isPresentCheckinStatus(status: string) {
  return (PRESENT_CHECKIN_STATUSES as readonly string[]).includes(status);
}

export function buildPublicPresentRoster(
  sessionId: string,
  candidates: PresentRosterCandidate[],
  keySecret: string
): PublicPresentAttendee[] {
  const merged = new Map<
    string,
    {
      name: string | null;
      nameSource: PresentNameSource;
      isLeader: boolean;
    }
  >();

  for (const candidate of candidates) {
    const ccbIndividualId = candidate.ccbIndividualId.trim();
    if (!ccbIndividualId) continue;

    const name = sanitizeAttendanceName(candidate.name);
    const existing = merged.get(ccbIndividualId);
    if (!existing) {
      merged.set(ccbIndividualId, {
        name,
        nameSource: candidate.nameSource,
        isLeader: Boolean(candidate.isLeader)
      });
      continue;
    }

    if (
      name &&
      (!existing.name ||
        NAME_SOURCE_PRIORITY[candidate.nameSource] >
          NAME_SOURCE_PRIORITY[existing.nameSource])
    ) {
      existing.name = name;
      existing.nameSource = candidate.nameSource;
    }
    existing.isLeader ||= Boolean(candidate.isLeader);
  }

  return [...merged.entries()]
    .map(([ccbIndividualId, attendee]) => ({
      key: publicRosterKey(sessionId, ccbIndividualId, keySecret),
      name: formatPublicAttendanceName(
        attendee.name ?? (attendee.isLeader ? "Group leader" : "Present participant")
      ),
      isLeader: attendee.isLeader
    }))
    .sort((left, right) => {
      if (left.isLeader !== right.isLeader) return left.isLeader ? -1 : 1;
      return left.name.localeCompare(right.name, "en", {
        sensitivity: "base"
      });
    });
}

export function formatPublicAttendanceName(value: string) {
  const name = sanitizeAttendanceName(value);
  if (!name) return "Present participant";
  if (/^(class|group) leader$/i.test(name)) return "Group leader";
  if (/^present participant$/i.test(name)) return "Present participant";

  const parts = name.split(" ");
  if (parts.length === 1) return parts[0];

  const suffixPattern = /^(?:jr\.?|sr\.?|ii|iii|iv)$/i;
  let lastName = parts.at(-1) ?? "";
  if (parts.length > 2 && suffixPattern.test(lastName)) {
    lastName = parts.at(-2) ?? lastName;
  }

  const initial = lastName.match(/[\p{L}\p{N}]/u)?.[0];
  return initial ? `${parts[0]} ${initial.toUpperCase()}.` : parts[0];
}

export function sanitizeAttendanceName(value: string | null | undefined) {
  if (!value) return null;
  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return sanitized || null;
}

function publicRosterKey(
  sessionId: string,
  ccbIndividualId: string,
  keySecret: string
) {
  return crypto
    .createHmac("sha256", keySecret)
    .update(`${sessionId}:${ccbIndividualId}`)
    .digest("hex")
    .slice(0, 20);
}
