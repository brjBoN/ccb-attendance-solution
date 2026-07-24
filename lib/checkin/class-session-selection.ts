export type ClassSessionCandidate = {
  id: string;
  status: string;
  meeting_kind?: string;
  occurrence_start_at: string | null;
  checkin_opens_at: string | null;
  checkin_closes_at: string | null;
  created_at?: string;
};

export function selectCurrentClassSession<T extends ClassSessionCandidate>(
  sessions: T[],
  now = new Date()
): T | null {
  const nowMs = now.getTime();
  const current = sessions.filter((session) => {
    if (session.status !== "active") return false;
    if (
      session.checkin_opens_at &&
      new Date(session.checkin_opens_at).getTime() > nowMs
    ) {
      return false;
    }
    if (
      session.checkin_closes_at &&
      new Date(session.checkin_closes_at).getTime() < nowMs
    ) {
      return false;
    }
    return true;
  });

  current.sort((left, right) => {
    const leftIsSpecial = left.meeting_kind === "special";
    const rightIsSpecial = right.meeting_kind === "special";
    if (leftIsSpecial !== rightIsSpecial) return leftIsSpecial ? -1 : 1;

    const leftDistance = left.occurrence_start_at
      ? Math.abs(new Date(left.occurrence_start_at).getTime() - nowMs)
      : Number.MAX_SAFE_INTEGER;
    const rightDistance = right.occurrence_start_at
      ? Math.abs(new Date(right.occurrence_start_at).getTime() - nowMs)
      : Number.MAX_SAFE_INTEGER;

    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return String(right.created_at ?? "").localeCompare(
      String(left.created_at ?? "")
    );
  });

  return current[0] ?? null;
}
