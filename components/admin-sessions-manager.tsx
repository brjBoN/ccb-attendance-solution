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
  CalendarDays,
  CalendarPlus,
  Check,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  QrCode,
  Radio,
  Save,
  Trash2,
  X
} from "lucide-react";

type GroupMapping = {
  id: string;
  ccb_group_id: string;
  group_name: string;
  ccb_event_id: string | null;
  public_checkin_slug: string | null;
  enabled: boolean;
};

type ScheduleSlot = {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type StoredScheduleSlot = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type SessionRow = {
  id: string;
  title: string;
  ccb_group_id: string;
  ccb_event_id: string;
  occurrence_date: string;
  occurrence_start_at: string | null;
  status: "draft" | "active" | "closed" | "cancelled";
  meeting_kind?: "regular" | "special";
};

type ClassLink = {
  mappingId: string;
  className: string;
  publicSlug: string;
  checkinUrl: string;
  qrDataUrl: string;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

function todayValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
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

function normalizeStoredTime(value: string) {
  return value.slice(0, 5);
}

export function AdminSessionsManager() {
  const [mappings, setMappings] = useState<GroupMapping[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState("");
  const [classLink, setClassLink] = useState<ClassLink | null>(null);
  const [classLinkLoading, setClassLinkLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [specialTitle, setSpecialTitle] = useState("");
  const [specialDate, setSpecialDate] = useState(todayValue);
  const [specialStart, setSpecialStart] = useState("18:00");
  const [specialEnd, setSpecialEnd] = useState("19:30");
  const [specialNote, setSpecialNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedMapping = useMemo(
    () => mappings.find((mapping) => mapping.id === selectedMappingId),
    [mappings, selectedMappingId]
  );

  const selectedSessions = useMemo(
    () =>
      sessions.filter(
        (session) => session.ccb_group_id === selectedMapping?.ccb_group_id
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
    if (!mappingId) return;
    setClassLinkLoading(true);
    setClassLink(null);
    const response = await fetch(
      `/api/admin/group-mappings/${mappingId}/class-link`
    );
    const data = await response.json();
    setClassLinkLoading(false);
    if (!response.ok) {
      setMessage(data.error ?? "Could not load the class QR code.");
      return;
    }
    setClassLink(data.classLink);
  }, []);

  const loadSchedule = useCallback(async (mappingId: string) => {
    if (!mappingId) return;
    setScheduleLoading(true);
    const response = await fetch(
      `/api/admin/group-mappings/${mappingId}/schedule`
    );
    const data = await response.json();
    setScheduleLoading(false);
    if (!response.ok) {
      setSchedule([]);
      setMessage(data.error ?? "Could not load the class schedule.");
      return;
    }

    const stored = (data.results ?? []) as StoredScheduleSlot[];
    setSchedule(
      stored.length
        ? stored.map((slot) => ({
            id: slot.id,
            dayOfWeek: slot.day_of_week,
            startTime: normalizeStoredTime(slot.start_time),
            endTime: normalizeStoredTime(slot.end_time)
          }))
        : [{ dayOfWeek: 0, startTime: "09:00", endTime: "10:15" }]
    );
  }, []);

  useEffect(() => {
    void loadMappings();
    void loadSessions();
  }, [loadMappings, loadSessions]);

  useEffect(() => {
    if (!selectedMapping) return;
    setMessage(null);
    setSpecialTitle("");
    void Promise.all([
      loadClassLink(selectedMapping.id),
      loadSchedule(selectedMapping.id)
    ]);
  }, [loadClassLink, loadSchedule, selectedMapping]);

  function updateScheduleSlot(index: number, patch: Partial<ScheduleSlot>) {
    setSchedule((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot
      )
    );
  }

  function addScheduleSlot() {
    const usedDays = new Set(schedule.map((slot) => slot.dayOfWeek));
    const nextDay = DAYS.findIndex((_day, index) => !usedDays.has(index));
    setSchedule((current) => [
      ...current,
      {
        dayOfWeek: nextDay >= 0 ? nextDay : 0,
        startTime: "18:00",
        endTime: "19:30"
      }
    ]);
  }

  function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMappingId || !schedule.length) return;

    startTransition(async () => {
      setMessage("Saving the class schedule...");
      const response = await fetch(
        `/api/admin/group-mappings/${selectedMappingId}/schedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots: schedule })
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not save the class schedule.");
        return;
      }

      setMessage(
        data.eventCreated
          ? "Schedule saved. The class attendance event was created in CCB automatically."
          : "Schedule saved. Check-in will open automatically around each class time."
      );
      await Promise.all([
        loadMappings(),
        loadSchedule(selectedMappingId)
      ]);
    });
  }

  function createSpecialMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMappingId) return;

    startTransition(async () => {
      setMessage("Adding the special meeting...");
      const response = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappingId: selectedMappingId,
          title: specialTitle,
          meetingDate: specialDate,
          startTime: specialStart,
          endTime: specialEnd,
          note: specialNote
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not add the special meeting.");
        return;
      }

      setMessage(
        "Special meeting added. It will use the class's normal check-in code."
      );
      setSpecialTitle("");
      setSpecialNote("");
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
          ? `Meeting marked ${status}.`
          : data.error ?? "Could not update this meeting."
      );
      if (response.ok) await loadSessions();
    });
  }

  async function copyLink() {
    if (!classLink) return;
    await navigator.clipboard.writeText(classLink.checkinUrl);
    setMessage("Class check-in link copied.");
  }

  return (
    <div className="space-y-7">
      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[28px] bg-[#12362f] text-white shadow-[0_24px_70px_rgba(24,45,39,0.14)] xl:sticky xl:top-24 xl:self-start">
          <div className="border-b border-white/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a8decf]">
              Class check-in code
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
              {selectedMapping?.group_name ?? "Choose a class"}
            </h2>
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

            <div className="mt-5 flex min-h-64 items-center justify-center rounded-2xl bg-white p-4">
              {classLinkLoading ? (
                <div className="text-center text-[#49615b]">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin" />
                  <p className="mt-3 text-sm font-medium">Loading class code</p>
                </div>
              ) : classLink ? (
                <Image
                  src={classLink.qrDataUrl}
                  alt={`QR code for ${classLink.className}`}
                  width={288}
                  height={288}
                  unoptimized
                  className="h-auto w-full max-w-64"
                  priority
                />
              ) : (
                <div className="text-center text-[#70817c]">
                  <QrCode className="mx-auto h-10 w-10" />
                  <p className="mt-3 text-sm font-medium">
                    Choose a class to view its code
                  </p>
                </div>
              )}
            </div>

            {classLink ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
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
                <a
                  href={classLink.checkinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white/65 transition hover:text-white"
                >
                  Preview check-in
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="space-y-6">
          {!mappings.length ? (
            <div className="surface-card p-10 text-center">
              <QrCode className="mx-auto h-10 w-10 text-[#81908a]" />
              <h2 className="mt-4 text-xl font-semibold text-[#18332d]">
                No classes are enabled yet
              </h2>
              <p className="mt-2 text-sm text-[#60706b]">
                Add a CCB class before setting attendance times.
              </p>
              <Link
                href="/admin/groups"
                className="mt-5 inline-flex rounded-xl bg-[#167365] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Manage classes
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={saveSchedule} className="surface-card p-5 sm:p-7">
                <div className="flex flex-col gap-4 border-b border-[#e8ebe6] pb-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#167365]">
                      <CalendarDays className="h-4 w-4" />
                      Regular schedule
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#18332d]">
                      When does this class meet?
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#60706b]">
                      Add every usual day and time. Check-in opens 30 minutes
                      before class and closes 30 minutes after it ends.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addScheduleSlot}
                    disabled={schedule.length >= 14}
                    className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#cbd7d1] bg-white px-4 py-2.5 text-sm font-semibold text-[#34544b] transition hover:bg-[#f5f8f6] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add another time
                  </button>
                </div>

                <div className="mt-6 space-y-3">
                  {scheduleLoading ? (
                    <div className="flex items-center justify-center py-12 text-sm text-[#667670]">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading schedule
                    </div>
                  ) : (
                    schedule.map((slot, index) => (
                      <div
                        key={slot.id ?? `new-${index}`}
                        className="grid gap-3 rounded-2xl border border-[#dfe5e0] bg-[#fafbf8] p-4 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end"
                      >
                        <Field label="Day">
                          <select
                            value={slot.dayOfWeek}
                            onChange={(event) =>
                              updateScheduleSlot(index, {
                                dayOfWeek: Number(event.target.value)
                              })
                            }
                            className="form-input"
                          >
                            {DAYS.map((day, dayIndex) => (
                              <option key={day} value={dayIndex}>
                                {day}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Starts">
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(event) =>
                              updateScheduleSlot(index, {
                                startTime: event.target.value
                              })
                            }
                            required
                            className="form-input"
                          />
                        </Field>
                        <Field label="Ends">
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(event) =>
                              updateScheduleSlot(index, {
                                endTime: event.target.value
                              })
                            }
                            required
                            className="form-input"
                          />
                        </Field>
                        <button
                          type="button"
                          onClick={() =>
                            setSchedule((current) =>
                              current.filter((_item, itemIndex) => itemIndex !== index)
                            )
                          }
                          disabled={schedule.length === 1}
                          aria-label="Remove meeting time"
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-[#e5d7d2] bg-white px-3 text-[#a14b3e] transition hover:bg-[#fff5f1] disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-6 flex justify-end border-t border-[#e8ebe6] pt-5">
                  <button
                    disabled={isPending || scheduleLoading || !schedule.length}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#167365] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(22,115,101,0.2)] transition hover:bg-[#0f6156] disabled:opacity-60"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save schedule
                  </button>
                </div>
              </form>

              <form
                onSubmit={createSpecialMeeting}
                className="surface-card overflow-hidden"
              >
                <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
                  <div className="bg-[#f2ece0] p-6 sm:p-7">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f1b86b] text-[#493a22]">
                      <CalendarPlus className="h-5 w-5" />
                    </div>
                    <h2 className="mt-5 text-2xl font-semibold tracking-[-0.025em] text-[#3d3426]">
                      Special-case meeting
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-[#746956]">
                      Add a one-time class date that falls outside the regular
                      schedule. Nothing else about the class changes.
                    </p>
                  </div>

                  <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-7">
                    <Field label="Date">
                      <input
                        type="date"
                        value={specialDate}
                        onChange={(event) => setSpecialDate(event.target.value)}
                        required
                        className="form-input"
                      />
                    </Field>
                    <Field label="Optional meeting name">
                      <input
                        value={specialTitle}
                        onChange={(event) => setSpecialTitle(event.target.value)}
                        placeholder="Holiday gathering"
                        className="form-input"
                      />
                    </Field>
                    <Field label="Starts">
                      <div className="relative">
                        <Clock3 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7b8a85]" />
                        <input
                          type="time"
                          value={specialStart}
                          onChange={(event) => setSpecialStart(event.target.value)}
                          required
                          className="form-input pl-10"
                        />
                      </div>
                    </Field>
                    <Field label="Ends">
                      <input
                        type="time"
                        value={specialEnd}
                        onChange={(event) => setSpecialEnd(event.target.value)}
                        required
                        className="form-input"
                      />
                    </Field>
                    <Field label="Optional note" className="sm:col-span-2">
                      <input
                        value={specialNote}
                        onChange={(event) => setSpecialNote(event.target.value)}
                        placeholder="Why this meeting is different"
                        className="form-input"
                      />
                    </Field>
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        disabled={isPending}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#493f30] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#332c22] disabled:opacity-60"
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Add special meeting
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </>
          )}

          {message ? (
            <div className="flex items-start gap-3 rounded-2xl border border-[#cfe2db] bg-[#edf6f2] p-4 text-sm leading-6 text-[#34544b]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#167365]" />
              <p>{message}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface-card p-5 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#167365]">
              Attendance history
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#18332d]">
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
                className="flex flex-col gap-4 rounded-2xl border border-[#e0e5e0] bg-[#fbfbf8] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e5f2ed] text-[#147466]">
                    {session.meeting_kind === "special" ? (
                      <CalendarPlus className="h-5 w-5" />
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
                      {session.meeting_kind === "special" ? (
                        <span className="rounded-full bg-[#fff1d8] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#876025]">
                          Special
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[#667670]">
                      {formatMeetingDate(
                        session.occurrence_start_at,
                        session.occurrence_date
                      )}
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
                      <Radio className="h-3.5 w-3.5" />
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
                No attendance records yet
              </p>
              <p className="mt-1 text-sm text-[#71807b]">
                Scheduled meetings appear here after the first check-in.
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
  className,
  children
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className ?? "block"}>
      <span className="text-sm font-semibold text-[#38534c]">{label}</span>
      <div className="mt-1.5">{children}</div>
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
      {status === "active" ? "Open" : status}
    </span>
  );
}
