"use client";

import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition
} from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Play,
  QrCode,
  Radio,
  X
} from "lucide-react";
import { CCB_ATTENDANCE_GROUPING_OPTIONS } from "@/lib/ccb/group-create-options";

type GroupMapping = {
  id: string;
  ccb_group_id: string;
  group_name: string;
  ccb_event_id: string | null;
  ccb_event_grouping_id: string | null;
  auto_add_checkins_to_group: boolean | null;
  public_checkin_slug: string | null;
  enabled: boolean;
};

type SessionRow = {
  id: string;
  title: string;
  ccb_group_id: string;
  ccb_event_id: string;
  occurrence_date: string;
  occurrence_start_at: string | null;
  checkin_opens_at: string | null;
  checkin_closes_at: string | null;
  status: "draft" | "active" | "closed" | "cancelled";
  options?: {
    group_name?: string;
    mapping_id?: string;
    event_grouping_id?: string | null;
    auto_add_checkins_to_group?: boolean;
  };
};

type ClassLink = {
  mappingId: string;
  className: string;
  publicSlug: string;
  checkinUrl: string;
  qrDataUrl: string;
};

function toLocalDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatMeetingDate(value: string | null, fallback: string) {
  const date = value ? new Date(value) : new Date(`${fallback}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: value ? "numeric" : undefined,
    minute: value ? "2-digit" : undefined
  }).format(date);
}

export function AdminSessionsManager() {
  const initialStart = useMemo(() => new Date(), []);
  const [mappings, setMappings] = useState<GroupMapping[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState("");
  const [classLink, setClassLink] = useState<ClassLink | null>(null);
  const [classLinkLoading, setClassLinkLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [eventGroupingId, setEventGroupingId] = useState("");
  const [autoAddCheckinsToGroup, setAutoAddCheckinsToGroup] = useState(true);
  const [eventDescription, setEventDescription] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<
    "none" | "daily" | "weekly" | "monthly"
  >("none");
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("1");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [numberOfOccurrences, setNumberOfOccurrences] = useState("");
  const [eventListed, setEventListed] = useState(false);
  const [attendanceReminder, setAttendanceReminder] = useState(true);
  const [occurrenceDate, setOccurrenceDate] = useState(
    toLocalDateTimeValue(initialStart).slice(0, 10)
  );
  const [startAt, setStartAt] = useState(toLocalDateTimeValue(initialStart));
  const [endAt, setEndAt] = useState(
    toLocalDateTimeValue(new Date(initialStart.getTime() + 90 * 60 * 1000))
  );
  const [opensAt, setOpensAt] = useState(
    toLocalDateTimeValue(new Date(initialStart.getTime() - 30 * 60 * 1000))
  );
  const [closesAt, setClosesAt] = useState(
    toLocalDateTimeValue(new Date(initialStart.getTime() + 2 * 60 * 60 * 1000))
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedMapping = useMemo(
    () => mappings.find((mapping) => mapping.id === selectedMappingId),
    [mappings, selectedMappingId]
  );

  const selectedGroupingLabel = useMemo(
    () =>
      CCB_ATTENDANCE_GROUPING_OPTIONS.find(
        (option) => option.value === eventGroupingId
      )?.label ?? "",
    [eventGroupingId]
  );

  const selectedSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.ccb_group_id === selectedMapping?.ccb_group_id
      ),
    [selectedMapping, sessions]
  );

  const loadMappings = useCallback(async () => {
    const response = await fetch("/api/admin/group-mappings?scope=session");
    const data = await response.json();
    const enabled = (data.results ?? []).filter(
      (mapping: GroupMapping) => mapping.enabled
    );
    setMappings(enabled);
    setSelectedMappingId((current) => current || enabled[0]?.id || "");
  }, []);

  const loadSessions = useCallback(async () => {
    const response = await fetch("/api/admin/sessions");
    const data = await response.json();
    setSessions(data.results ?? []);
  }, []);

  const loadClassLink = useCallback(async (mappingId: string) => {
    if (!mappingId) {
      setClassLink(null);
      return;
    }

    setClassLinkLoading(true);
    setClassLink(null);
    const response = await fetch(
      `/api/admin/group-mappings/${mappingId}/class-link`
    );
    const data = await response.json();
    setClassLinkLoading(false);

    if (!response.ok) {
      setMessage(data.error ?? "Could not load the permanent class QR code.");
      return;
    }

    setClassLink(data.classLink);
  }, []);

  useEffect(() => {
    void loadMappings();
    void loadSessions();
  }, [loadMappings, loadSessions]);

  useEffect(() => {
    if (!selectedMapping) return;
    setEventId(selectedMapping.ccb_event_id ?? "");
    setEventGroupingId(selectedMapping.ccb_event_grouping_id ?? "");
    setAutoAddCheckinsToGroup(
      selectedMapping.auto_add_checkins_to_group ?? true
    );
    setTitle(`${selectedMapping.group_name} Meeting`);
    void loadClassLink(selectedMapping.id);
  }, [loadClassLink, selectedMapping]);

  function createMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMappingId) {
      setMessage("Choose a class first.");
      return;
    }

    if (!eventId && !eventGroupingId) {
      setMessage(
        "Choose a CCB Attendance Grouping before creating a new CCB event."
      );
      return;
    }

    startTransition(async () => {
      setMessage(
        eventId
          ? "Opening this meeting for check-in..."
          : "Creating the CCB event and opening this meeting..."
      );

      const response = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappingId: selectedMappingId,
          title,
          ccbEventId: eventId,
          eventGroupingId,
          autoAddCheckinsToGroup,
          occurrenceDate,
          occurrenceStartAt: localInputToIso(startAt),
          occurrenceEndAt: localInputToIso(endAt),
          occurrenceLocalStart: startAt,
          occurrenceLocalEnd: endAt,
          checkinOpensAt: localInputToIso(opensAt),
          checkinClosesAt: localInputToIso(closesAt),
          status: "active",
          createEventIfMissing: true,
          eventDescription,
          recurrenceType,
          recurrenceFrequency: Number(recurrenceFrequency || 1),
          recurrenceEndDate,
          numberOfOccurrences: numberOfOccurrences
            ? Number(numberOfOccurrences)
            : null,
          eventListed,
          attendanceReminder,
          eventNotification: false
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not open this meeting.");
        return;
      }

      setClassLink(data.classLink);
      setEventId(data.session.ccb_event_id);
      setMessage(
        data.createdEvent
          ? `Meeting is open. CCB event ${data.createdEvent.id} was created with ${selectedGroupingLabel || eventGroupingId}. The class QR code did not change.`
          : "Meeting is open. Members can scan the class's usual QR code now."
      );
      await Promise.all([loadMappings(), loadSessions()]);
    });
  }

  function updateStatus(
    session: SessionRow,
    status: "active" | "closed" | "cancelled"
  ) {
    startTransition(async () => {
      const response = await fetch(`/api/admin/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      setMessage(
        response.ok
          ? status === "active"
            ? "Meeting is open. The permanent class QR now points here."
            : `Meeting marked ${status}.`
          : data.error ?? "Could not update this meeting."
      );
      if (response.ok) await loadSessions();
    });
  }

  async function copyLink() {
    if (!classLink) return;
    await navigator.clipboard.writeText(classLink.checkinUrl);
    setMessage("Permanent class check-in link copied.");
  }

  return (
    <div className="space-y-7">
      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[28px] border border-[#d9ddd7] bg-[#12362f] text-white shadow-[0_24px_70px_rgba(24,45,39,0.12)] xl:sticky xl:top-24 xl:self-start">
          <div className="border-b border-white/10 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#a8decf]">
              <Radio className="h-4 w-4" />
              Permanent class check-in
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">
              One code. Every meeting.
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Print it once or save the link. Opening a meeting makes this same
              code ready for attendance.
            </p>
          </div>

          <div className="p-6">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Class
              </span>
              <select
                value={selectedMappingId}
                onChange={(event) => setSelectedMappingId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm text-white outline-none focus:border-[#a8decf] focus:ring-2 focus:ring-[#a8decf]/20"
              >
                {mappings.map((mapping) => (
                  <option
                    key={mapping.id}
                    value={mapping.id}
                    className="text-slate-950"
                  >
                    {mapping.group_name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 flex min-h-72 items-center justify-center rounded-2xl bg-white p-4">
              {classLinkLoading ? (
                <div className="text-center text-[#49615b]">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin" />
                  <p className="mt-3 text-sm font-medium">Loading class code</p>
                </div>
              ) : classLink ? (
                <Image
                  src={classLink.qrDataUrl}
                  alt={`Permanent QR code for ${classLink.className}`}
                  width={288}
                  height={288}
                  unoptimized
                  className="h-auto w-full max-w-72"
                  priority
                />
              ) : (
                <div className="text-center text-[#70817c]">
                  <QrCode className="mx-auto h-10 w-10" />
                  <p className="mt-3 text-sm font-medium">
                    Choose a class to view its QR
                  </p>
                </div>
              )}
            </div>

            {classLink ? (
              <>
                <p className="mt-4 truncate rounded-xl bg-white/10 px-3 py-2.5 text-xs text-white/75">
                  {classLink.checkinUrl}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f1b86b] px-3 py-2.5 text-sm font-semibold text-[#2f2b1f] transition hover:bg-[#f5c681]"
                  >
                    <Copy className="h-4 w-4" />
                    Copy link
                  </button>
                  <a
                    href={classLink.qrDataUrl}
                    download={`${classLink.className.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-class-qr.png`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </div>
                <a
                  href={classLink.checkinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white/65 transition hover:text-white"
                >
                  Preview check-in page
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </>
            ) : null}
          </div>
        </aside>

        <div className="rounded-[28px] border border-[#d9ddd7] bg-white p-5 shadow-[0_24px_70px_rgba(24,45,39,0.08)] sm:p-7">
          <div className="flex flex-col gap-4 border-b border-[#e8ebe6] pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#167365]">
                <Play className="h-4 w-4" />
                Open attendance
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#18332d]">
                Open a meeting
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#60706b]">
                Set today&apos;s attendance window. The permanent class QR will
                automatically send members to this meeting.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e5f4ef] px-3 py-1.5 text-xs font-semibold text-[#12675b]">
              <Link2 className="h-3.5 w-3.5" />
              QR stays the same
            </div>
          </div>

          {!mappings.length ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#c8d1cb] bg-[#f8f8f4] p-8 text-center">
              <QrCode className="mx-auto h-9 w-9 text-[#81908a]" />
              <h3 className="mt-3 font-semibold text-[#18332d]">
                No classes are enabled yet
              </h3>
              <p className="mt-1 text-sm text-[#60706b]">
                Add a CCB group before opening attendance.
              </p>
              <Link
                href="/admin/groups"
                className="mt-4 inline-flex rounded-xl bg-[#167365] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Manage classes
              </Link>
            </div>
          ) : (
            <form onSubmit={createMeeting} className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Meeting name" className="sm:col-span-2">
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    className="form-input"
                  />
                </Field>

                <Field label="Starts">
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7b8a85]" />
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(event) => {
                        setStartAt(event.target.value);
                        setOccurrenceDate(event.target.value.slice(0, 10));
                      }}
                      required
                      className="form-input pl-10"
                    />
                  </div>
                </Field>
                <Field label="Ends">
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7b8a85]" />
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(event) => setEndAt(event.target.value)}
                      required
                      className="form-input pl-10"
                    />
                  </div>
                </Field>
                <Field label="Check-in opens" help="Usually 30 minutes before">
                  <input
                    type="datetime-local"
                    value={opensAt}
                    onChange={(event) => setOpensAt(event.target.value)}
                    className="form-input"
                  />
                </Field>
                <Field label="Check-in closes" help="The QR pauses after this time">
                  <input
                    type="datetime-local"
                    value={closesAt}
                    onChange={(event) => setClosesAt(event.target.value)}
                    className="form-input"
                  />
                </Field>
              </div>

              <details className="group rounded-2xl border border-[#dfe4df] bg-[#fafaf7]">
                <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-[#304b44] marker:hidden">
                  <span className="flex items-center justify-between">
                    CCB event settings
                    <span className="text-xs font-medium text-[#7b8a85] group-open:hidden">
                      Show
                    </span>
                    <span className="hidden text-xs font-medium text-[#7b8a85] group-open:inline">
                      Hide
                    </span>
                  </span>
                </summary>
                <div className="grid gap-4 border-t border-[#e4e8e3] p-4 sm:grid-cols-2">
                  <Field
                    label="Existing CCB event ID"
                    help="Leave blank to create and map an event."
                  >
                    <input
                      value={eventId}
                      onChange={(event) => setEventId(event.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field
                    label="CCB Attendance Grouping"
                    help="Required when the app creates the event."
                  >
                    <select
                      value={eventGroupingId}
                      onChange={(event) =>
                        setEventGroupingId(event.target.value)
                      }
                      className="form-input"
                    >
                      <option value="">Choose attendance grouping...</option>
                      {CCB_ATTENDANCE_GROUPING_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {eventId ? (
                    <div className="sm:col-span-2 flex gap-3 rounded-xl border border-[#ead9b4] bg-[#fff8e8] p-4 text-sm leading-6 text-[#6f5627]">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      Confirm this event already has the correct Attendance
                      Grouping in CCB.
                    </div>
                  ) : (
                    <>
                      <Field label="Recurrence">
                        <select
                          value={recurrenceType}
                          onChange={(event) =>
                            setRecurrenceType(
                              event.target.value as typeof recurrenceType
                            )
                          }
                          className="form-input"
                        >
                          <option value="none">One-time event</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </Field>
                      <Field label="Repeat every">
                        <input
                          type="number"
                          min="1"
                          max="52"
                          value={recurrenceFrequency}
                          onChange={(event) =>
                            setRecurrenceFrequency(event.target.value)
                          }
                          className="form-input"
                        />
                      </Field>
                      <Field label="Number of meetings" help="Optional">
                        <input
                          type="number"
                          min="1"
                          max="520"
                          value={numberOfOccurrences}
                          onChange={(event) =>
                            setNumberOfOccurrences(event.target.value)
                          }
                          className="form-input"
                        />
                      </Field>
                      <Field label="Recurrence ends" help="Optional">
                        <input
                          type="date"
                          value={recurrenceEndDate}
                          onChange={(event) =>
                            setRecurrenceEndDate(event.target.value)
                          }
                          className="form-input"
                        />
                      </Field>
                    </>
                  )}

                  <Field label="Event description" className="sm:col-span-2">
                    <textarea
                      value={eventDescription}
                      onChange={(event) =>
                        setEventDescription(event.target.value)
                      }
                      rows={3}
                      className="form-input resize-y"
                    />
                  </Field>

                  <label className="flex items-start gap-3 rounded-xl border border-[#dfe4df] bg-white p-4 text-sm text-[#52645e]">
                    <input
                      type="checkbox"
                      checked={autoAddCheckinsToGroup}
                      onChange={(event) =>
                        setAutoAddCheckinsToGroup(event.target.checked)
                      }
                      className="mt-1 accent-[#167365]"
                    />
                    <span>
                      <strong className="block text-[#263f38]">
                        Add check-ins to the CCB group
                      </strong>
                      New participants are added to the mapped class.
                    </span>
                  </label>
                  {!eventId ? (
                    <div className="grid gap-2">
                      <label className="flex items-center gap-2 rounded-xl border border-[#dfe4df] bg-white px-4 py-3 text-sm text-[#52645e]">
                        <input
                          type="checkbox"
                          checked={attendanceReminder}
                          onChange={(event) =>
                            setAttendanceReminder(event.target.checked)
                          }
                          className="accent-[#167365]"
                        />
                        Attendance reminder
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border border-[#dfe4df] bg-white px-4 py-3 text-sm text-[#52645e]">
                        <input
                          type="checkbox"
                          checked={eventListed}
                          onChange={(event) =>
                            setEventListed(event.target.checked)
                          }
                          className="accent-[#167365]"
                        />
                        List event in CCB
                      </label>
                    </div>
                  ) : null}
                </div>
              </details>

              <div className="flex flex-col gap-3 border-t border-[#e8ebe6] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#6b7a75]">
                  Opening this meeting closes any previously open meeting for
                  the class.
                </p>
                <button
                  disabled={isPending || !mappings.length}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#167365] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(22,115,101,0.2)] transition hover:bg-[#0f6156] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Radio className="h-4 w-4" />
                  )}
                  Open meeting
                </button>
              </div>
            </form>
          )}

          {message ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#eef5f1] p-4 text-sm leading-6 text-[#34544b]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#167365]" />
              <p>{message}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#d9ddd7] bg-white p-5 shadow-[0_20px_60px_rgba(24,45,39,0.06)] sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#167365]">Meeting history</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[#18332d]">
              {selectedMapping?.group_name ?? "Class meetings"}
            </h2>
          </div>
          <p className="text-sm text-[#71807b]">
            {selectedSessions.length} meeting
            {selectedSessions.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {selectedSessions.length ? (
            selectedSessions.map((session) => (
              <article
                key={session.id}
                className="flex flex-col gap-4 rounded-2xl border border-[#e0e5e0] bg-[#fbfbf8] p-4 transition hover:border-[#c9d5cf] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      session.status === "active"
                        ? "bg-[#dff3ec] text-[#147466]"
                        : "bg-[#eceeea] text-[#72817c]"
                    }`}
                  >
                    {session.status === "active" ? (
                      <Radio className="h-5 w-5" />
                    ) : (
                      <CalendarDays className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-[#203b34]">
                        {session.title}
                      </h3>
                      <StatusBadge status={session.status} />
                    </div>
                    <p className="mt-1 text-sm text-[#667670]">
                      {formatMeetingDate(
                        session.occurrence_start_at,
                        session.occurrence_date
                      )}{" "}
                      · CCB event {session.ccb_event_id}
                    </p>
                    <Link
                      href={`/admin/sessions/${session.id}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#167365] hover:underline"
                    >
                      View attendance
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateStatus(
                        session,
                        session.status === "active" ? "closed" : "active"
                      )
                    }
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#ced7d1] bg-white px-3 py-2 text-xs font-semibold text-[#36534b] transition hover:bg-[#f1f5f2] disabled:opacity-50"
                  >
                    {session.status === "active" ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    {session.status === "active" ? "Close" : "Reopen"}
                  </button>
                  {session.status !== "cancelled" ? (
                    <button
                      type="button"
                      onClick={() => updateStatus(session, "cancelled")}
                      disabled={isPending}
                      className="rounded-xl px-3 py-2 text-xs font-semibold text-[#a14b3e] transition hover:bg-[#fff0ec] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[#cdd5d0] bg-[#fafaf7] p-10 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-[#8b9994]" />
              <p className="mt-3 font-semibold text-[#29453e]">
                No meetings yet
              </p>
              <p className="mt-1 text-sm text-[#71807b]">
                Open the first meeting when your class is ready to take
                attendance.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  help,
  className,
  children
}: {
  label: string;
  help?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className ?? "block"}>
      <span className="text-sm font-semibold text-[#38534c]">{label}</span>
      <div className="mt-1.5">{children}</div>
      {help ? (
        <span className="mt-1.5 block text-xs leading-5 text-[#7a8984]">
          {help}
        </span>
      ) : null}
    </label>
  );
}

function StatusBadge({ status }: { status: SessionRow["status"] }) {
  const style =
    status === "active"
      ? "bg-[#dff3ec] text-[#12675b]"
      : status === "cancelled"
        ? "bg-[#fff0ec] text-[#9a4639]"
        : "bg-[#eceeea] text-[#64736e]";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${style}`}
    >
      {status === "active" ? "Open now" : status}
    </span>
  );
}
