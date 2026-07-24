export type ResolvedCheckinSession = {
  id: string;
  title: string;
  ccbGroupId: string;
  ccbEventId: string;
  occurrenceDate: string;
  occurrenceStartAt: string | null;
  occurrenceEndAt: string | null;
  checkinOpensAt: string | null;
  checkinClosesAt: string | null;
  status: string;
  groupName: string | null;
  eventGroupingId: string | null;
  autoAddCheckinsToGroup: boolean;
  reusableClassLink: boolean;
};

export type CheckinUnavailableReason =
  | "not_found"
  | "revoked"
  | "expired"
  | "not_active"
  | "not_open_yet"
  | "closed"
  | "no_meeting";

export type InternalCheckinSessionResult =
  | {
      ok: true;
      session: ResolvedCheckinSession;
    }
  | {
      ok: false;
      reason: CheckinUnavailableReason;
      message: string;
      groupName?: string;
    };
