import "server-only";

import { getInternalCheckinSessionByToken } from "@/lib/checkin/session-token";

export type PublicCheckinSessionResult =
  | {
      ok: true;
      session: {
        id: string;
        title: string;
        groupName: string | null;
        occurrenceDate: string;
        occurrenceStartAt: string | null;
        occurrenceEndAt: string | null;
        checkinOpensAt: string | null;
        checkinClosesAt: string | null;
        status: string;
      };
    }
  | {
      ok: false;
      reason: "not_found" | "revoked" | "expired" | "not_active" | "not_open_yet" | "closed";
      message: string;
    };

export async function getPublicCheckinSessionByToken(
  token: string
): Promise<PublicCheckinSessionResult> {
  const result = await getInternalCheckinSessionByToken(token);

  if (!result.ok) return result;

  return {
    ok: true,
    session: {
      id: result.session.id,
      title: result.session.title,
      groupName: result.session.groupName,
      occurrenceDate: result.session.occurrenceDate,
      occurrenceStartAt: result.session.occurrenceStartAt,
      occurrenceEndAt: result.session.occurrenceEndAt,
      checkinOpensAt: result.session.checkinOpensAt,
      checkinClosesAt: result.session.checkinClosesAt,
      status: result.session.status
    }
  };
}
