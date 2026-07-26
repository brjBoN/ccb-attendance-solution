"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  UserCheck,
  UsersRound
} from "lucide-react";

type RosterAttendee = {
  key: string;
  name: string;
  isLeader: boolean;
};

type RosterResponse = {
  state: "open" | "no_active_meeting";
  attendees: RosterAttendee[];
  count: number;
  updatedAt: string;
  partial?: boolean;
  message?: string;
};

const POLL_INTERVAL_MS = 10_000;
const MAX_STALE_ROSTER_MS = 60_000;

export function TeacherAttendanceRoster({ token }: { token: string }) {
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const rosterRef = useRef<RosterResponse | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(
    async ({ restart = false }: { restart?: boolean } = {}) => {
      if (requestRef.current) {
        if (!restart) return;
        requestRef.current.abort();
      }

      const controller = new AbortController();
      requestRef.current = controller;

      if (rosterRef.current) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await fetch(
          `/api/present/g/${encodeURIComponent(token)}/roster`,
          {
            cache: "no-store",
            signal: controller.signal
          }
        );
        const payload: unknown = await response.json().catch(() => null);

        if (response.status === 404 || response.status === 410) {
          rosterRef.current = null;
          setRoster(null);
        }

        if (!response.ok) {
          throw new Error(readMessage(payload) ?? "Attendance could not be refreshed.");
        }
        if (!isRosterResponse(payload)) {
          throw new Error("Attendance returned an unexpected response.");
        }

        rosterRef.current = payload;
        setRoster(payload);
        setError(null);
      } catch (refreshError) {
        if (
          refreshError instanceof DOMException &&
          refreshError.name === "AbortError"
        ) {
          return;
        }

        const lastGoodRoster = rosterRef.current;
        const lastGoodTime = lastGoodRoster
          ? new Date(lastGoodRoster.updatedAt).getTime()
          : Number.NaN;
        if (
          lastGoodRoster &&
          (!Number.isFinite(lastGoodTime) ||
            Date.now() - lastGoodTime > MAX_STALE_ROSTER_MS)
        ) {
          rosterRef.current = null;
          setRoster(null);
        }

        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "Attendance could not be refreshed."
        );
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [token]
  );

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    rosterRef.current = null;
    setRoster(null);
    setError(null);
    setIsLoading(true);
    setIsRefreshing(false);
    void refresh();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, POLL_INTERVAL_MS);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [refresh]);

  const lastUpdated = useMemo(() => {
    if (!roster?.updatedAt) return null;
    const updatedAt = new Date(roster.updatedAt);
    if (Number.isNaN(updatedAt.valueOf())) return null;

    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    }).format(updatedAt);
  }, [roster?.updatedAt]);

  const count = roster?.count ?? 0;
  const statusText = getStatusText({
    roster,
    error,
    isLoading
  });

  return (
    <section className="mt-4 w-full max-w-md shrink-0 overflow-hidden rounded-[22px] border border-[#d7e2ee] bg-white text-left shadow-[0_16px_38px_rgba(7,31,63,0.1)]">
      <div className="flex items-center justify-between gap-3 bg-[#071f3f] px-4 py-3.5 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0099cb]/20 text-[#8ee3f5]">
            <UsersRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold tracking-[-0.015em]">Present now</h2>
              {roster?.state === "open" ? (
                <span className="rounded-full bg-[#e6f8fc] px-2 py-0.5 text-xs font-bold tabular-nums text-[#007fa9]">
                  {count}
                </span>
              ) : null}
            </div>
            <p
              aria-live="polite"
              aria-atomic="true"
              className="mt-0.5 truncate text-xs text-white/60"
            >
              {statusText}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refresh({ restart: true })}
          disabled={isLoading || isRefreshing}
          aria-label="Refresh attendance"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/15 hover:text-white disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading || isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="p-3.5 sm:p-4">
        {isLoading && !roster ? <RosterSkeleton /> : null}

        {!isLoading && !roster && error ? (
          <CenteredState
            icon={<AlertCircle className="h-5 w-5" />}
            title="Attendance is unavailable"
            message="Check the connection, then try again."
            tone="error"
            action={
              <button
                type="button"
                onClick={() => void refresh({ restart: true })}
                className="mt-3 rounded-xl bg-[#0866ff] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#0754d6]"
              >
                Try again
              </button>
            }
          />
        ) : null}

        {roster?.state === "no_active_meeting" ? (
          <CenteredState
            icon={<Clock3 className="h-5 w-5" />}
            title="Attendance isn’t open"
            message={roster.message ?? "The roster will appear during the class check-in window."}
          />
        ) : null}

        {roster?.state === "open" &&
        roster.attendees.length === 0 &&
        !roster.partial ? (
          <CenteredState
            icon={<UserCheck className="h-5 w-5" />}
            title="No one has checked in yet"
            message="Names will appear here as people scan the code."
          />
        ) : null}

        {roster?.state === "open" &&
        roster.attendees.length === 0 &&
        roster.partial ? (
          <CenteredState
            icon={<Loader2 className="h-5 w-5 animate-spin" />}
            title="Attendance is still syncing"
            message="The list could not be fully confirmed yet. Retrying automatically."
          />
        ) : null}

        {roster?.state === "open" && roster.attendees.length > 0 ? (
          <ul className="grid gap-2 pr-1 md:max-h-48 md:overflow-y-auto xl:grid-cols-2">
            {roster.attendees.map((attendee) => (
              <li
                key={attendee.key}
                className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[#dce8f4] bg-[#f4f9ff] px-3 py-2.5"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0099cb]" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#17304d]">
                  {minimizeName(attendee.name)}
                </span>
                {attendee.isLeader ? (
                  <span className="shrink-0 rounded-full bg-[#dcecff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0754d6]">
                    Leader
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {roster?.partial ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#fff7e6] px-3 py-2 text-xs leading-5 text-[#795515]">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              {roster.message ??
                "Some attendance may take another moment to appear."}
            </p>
          </div>
        ) : null}

        {error && roster ? (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-[#fff1f1] px-3 py-2 text-xs leading-5 text-[#8b3333]">
            <div className="flex min-w-0 items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>Couldn’t refresh. The last attendance list is still shown.</p>
            </div>
            <button
              type="button"
              onClick={() => void refresh({ restart: true })}
              className="shrink-0 font-bold text-[#0754d6] hover:underline"
            >
              Retry
            </button>
          </div>
        ) : null}

        {lastUpdated && roster ? (
          <p className="mt-2.5 text-center text-[11px] text-[#8797a8]">
            Updated {lastUpdated}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function RosterSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-2 xl:grid-cols-2">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-10 animate-pulse rounded-xl bg-[#eaf2fa]"
        />
      ))}
    </div>
  );
}

function CenteredState({
  icon,
  title,
  message,
  tone = "default",
  action
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  tone?: "default" | "error";
  action?: React.ReactNode;
}) {
  return (
    <div className="px-3 py-4 text-center">
      <span
        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl ${
          tone === "error"
            ? "bg-[#fff1f1] text-[#a33a3a]"
            : "bg-[#eaf4ff] text-[#0866ff]"
        }`}
      >
        {icon}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-[#17304d]">{title}</h3>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#6a7c91]">
        {message}
      </p>
      {action}
    </div>
  );
}

function getStatusText({
  roster,
  error,
  isLoading
}: {
  roster: RosterResponse | null;
  error: string | null;
  isLoading: boolean;
}) {
  if (isLoading && !roster) return "Checking attendance…";
  if (!roster && error) return "Couldn’t load attendance";
  if (roster?.state === "no_active_meeting") return "No active meeting";
  if (roster?.state === "open") {
    const count = roster.count;
    if (roster.partial) {
      return count
        ? `${count} showing · still syncing`
        : "Attendance is still syncing";
    }
    return `${count} ${count === 1 ? "person" : "people"} present${
      error ? " · refresh needed" : ""
    }`;
  }
  return "Checking attendance…";
}

function minimizeName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Attendee";
  if (trimmed.toLowerCase() === "class leader") return "Class leader";
  if (trimmed.toLowerCase() === "present participant") {
    return "Present participant";
  }

  const parts = trimmed.split(" ");
  if (parts.length === 1) return parts[0];

  const suffixes = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"]);
  const lastPart = suffixes.has(parts.at(-1)?.toLowerCase() ?? "")
    ? parts.at(-2)
    : parts.at(-1);
  const initial = lastPart?.match(/[\p{L}\p{N}]/u)?.[0];

  return initial ? `${parts[0]} ${initial.toUpperCase()}.` : parts[0];
}

function readMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const response = value as { message?: unknown; error?: unknown };
  const message = response.message ?? response.error;
  return typeof message === "string" && message.trim()
    ? message.trim()
    : null;
}

function isRosterResponse(value: unknown): value is RosterResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RosterResponse>;

  return (
    (candidate.state === "open" ||
      candidate.state === "no_active_meeting") &&
    Array.isArray(candidate.attendees) &&
    candidate.attendees.every(
      (attendee) =>
        attendee &&
        typeof attendee === "object" &&
        typeof attendee.key === "string" &&
        typeof attendee.name === "string" &&
        typeof attendee.isLeader === "boolean"
    ) &&
    typeof candidate.count === "number" &&
    Number.isFinite(candidate.count) &&
    typeof candidate.updatedAt === "string"
  );
}
