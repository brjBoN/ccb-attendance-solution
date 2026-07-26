"use client";

import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  Link2,
  Loader2,
  MonitorUp,
  Plus,
  QrCode,
  Radio,
  Save,
  Trash2,
  X
} from "lucide-react";
import {
  describeScheduleWindow,
  WEEKDAY_NAMES
} from "@/lib/checkin/schedule-window";

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
  opensMinutesBefore: number;
  closesMinutesAfter: number;
};

type StoredScheduleSlot = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  checkin_opens_minutes_before: number;
  checkin_closes_minutes_after: number;
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
  presentationUrl: string;
  qrDataUrl: string;
};

const DEFAULT_CHECKIN_MARGIN_MINUTES = 30;

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
  const [savedSchedule, setSavedSchedule] = useState<ScheduleSlot[]>([]);
  const [specialTitle, setSpecialTitle] = useState("");
  const [specialDate, setSpecialDate] = useState(todayValue);
  const [specialStart, setSpecialStart] = useState("18:00");
  const [specialEnd, setSpecialEnd] = useState("19:30");
  const [specialNote, setSpecialNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const latestMappingIdRef = useRef("");

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
    if (latestMappingIdRef.current !== mappingId) return;
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
    setSavedSchedule([]);
    const response = await fetch(
      `/api/admin/group-mappings/${mappingId}/schedule`
    );
    const data = await response.json();
    if (latestMappingIdRef.current !== mappingId) return;
    setScheduleLoading(false);
    if (!response.ok) {
      setSchedule([]);
      setSavedSchedule([]);
      setMessage(data.error ?? "Could not load the class schedule.");
      return;
    }

    const stored = (data.results ?? []) as StoredScheduleSlot[];
    const normalized = stored.map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.day_of_week,
      startTime: normalizeStoredTime(slot.start_time),
      endTime: normalizeStoredTime(slot.end_time),
      opensMinutesBefore:
        slot.checkin_opens_minutes_before ?? DEFAULT_CHECKIN_MARGIN_MINUTES,
      closesMinutesAfter:
        slot.checkin_closes_minutes_after ?? DEFAULT_CHECKIN_MARGIN_MINUTES
    }));
    setSavedSchedule(normalized);
    setSchedule(
      normalized.length
        ? normalized
        : [
            {
              dayOfWeek: 0,
              startTime: "09:00",
              endTime: "10:15",
              opensMinutesBefore: DEFAULT_CHECKIN_MARGIN_MINUTES,
              closesMinutesAfter: DEFAULT_CHECKIN_MARGIN_MINUTES
            }
          ]
    );
  }, []);

  useEffect(() => {
    void loadMappings();
    void loadSessions();
  }, [loadMappings, loadSessions]);

  useEffect(() => {
    if (!selectedMapping) return;
    latestMappingIdRef.current = selectedMapping.id;
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
    const nextDay = WEEKDAY_NAMES.findIndex(
      (_day, index) => !usedDays.has(index)
    );
    setSchedule((current) => [
      ...current,
      {
        dayOfWeek: nextDay >= 0 ? nextDay : 0,
        startTime: "18:00",
        endTime: "19:30",
        opensMinutesBefore: DEFAULT_CHECKIN_MARGIN_MINUTES,
        closesMinutesAfter: DEFAULT_CHECKIN_MARGIN_MINUTES
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
    setMessage("Participant check-in link copied.");
  }

  async function copyPresentationLink() {
    if (!classLink) return;
    await navigator.clipboard.writeText(classLink.presentationUrl);
    setMessage("Teacher display link copied.");
  }

  return (
    <div className="space-y-7">
      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[28px] bg-[#071f3f] text-white shadow-[0_24px_70px_rgba(7,31,63,0.14)] xl:sticky xl:top-24 xl:self-start">
          <div className="border-b border-white/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74d9f1]">
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
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm text-white outline-none focus:border-[#74d9f1] focus:ring-2 focus:ring-[#74d9f1]/20"
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
                <div className="text-center text-[#51677f]">
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
                <div className="text-center text-[#6a7c91]">
                  <QrCode className="mx-auto h-10 w-10" />
                  <p className="mt-3 text-sm font-medium">
                    Choose a class to view its code
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#74d9f1]">
                  <Clock3 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Attendance hours
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">
                    Eastern Time
                  </p>
                </div>
              </div>

              {scheduleLoading ? (
                <p className="mt-4 text-sm text-white/55">
                  Loading attendance hours...
                </p>
              ) : savedSchedule.length ? (
                <div className="mt-4 space-y-3">
                  {savedSchedule.map((slot) => {
                    const window = describeScheduleWindow(slot);
                    return (
                      <div
                        key={
                          slot.id ??
                          `${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`
                        }
                        className="rounded-xl border border-white/10 bg-black/10 p-3"
                      >
                        <p className="text-sm font-semibold text-white">
                          {window.dayName}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-white/65">
                          Class: {window.meetingTime}
                        </p>
                        <p className="text-xs leading-5 text-[#74d9f1]">
                          Check-in open: {window.attendanceWindow}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-white/55">
                  Save a regular schedule to set attendance hours.
                </p>
              )}
            </div>

            {classLink ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0099cb] px-3 py-2.5 text-sm font-semibold text-[#071f3f] transition hover:bg-[#18abd0]"
                >
                  <Copy className="h-4 w-4" />
                  Copy check-in
                </button>
                <a
                  href={classLink.qrDataUrl}
                  download={`${classLink.className.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-class-qr.png`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={copyPresentationLink}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#74d9f1]/35 bg-[#74d9f1]/10 px-3 py-2.5 text-sm font-semibold text-[#c8f2e6] transition hover:bg-[#74d9f1]/15"
                >
                  <Link2 className="h-4 w-4" />
                  Copy teacher link
                </button>
                <a
                  href={classLink.presentationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <MonitorUp className="h-4 w-4" />
                  Open display
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
              <QrCode className="mx-auto h-10 w-10 text-[#7a8b9d]" />
              <h2 className="mt-4 text-xl font-semibold text-[#0b1f3a]">
                No classes are enabled yet
              </h2>
              <p className="mt-2 text-sm text-[#66798d]">
                Add a CCB class before setting attendance times.
              </p>
              <Link
                href="/admin/groups"
                className="mt-5 inline-flex rounded-xl bg-[#0866ff] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Manage classes
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={saveSchedule} className="surface-card p-5 sm:p-7">
                <div className="flex flex-col gap-4 border-b border-[#e2ebf4] pb-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0866ff]">
                      <CalendarDays className="h-4 w-4" />
                      Regular schedule
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#0b1f3a]">
                      When does this class meet?
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66798d]">
                      Add every usual day and time. Check-in opens 30 minutes
                      before class and closes 30 minutes after it ends.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addScheduleSlot}
                    disabled={schedule.length >= 14}
                    className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#cbd9e7] bg-white px-4 py-2.5 text-sm font-semibold text-[#2b4966] transition hover:bg-[#f8fbff] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add another time
                  </button>
                </div>

                <div className="mt-6 space-y-3">
                  {scheduleLoading ? (
                    <div className="flex items-center justify-center py-12 text-sm text-[#5f7187]">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading schedule
                    </div>
                  ) : (
                    schedule.map((slot, index) => (
                      <div
                        key={slot.id ?? `new-${index}`}
                        className="grid gap-3 rounded-2xl border border-[#dce7f1] bg-[#f8fbff] p-4 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end"
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
                            {WEEKDAY_NAMES.map((day, dayIndex) => (
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

                <div className="mt-6 flex justify-end border-t border-[#e2ebf4] pt-5">
                  <button
                    disabled={isPending || scheduleLoading || !schedule.length}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0866ff] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(8,102,255,0.2)] transition hover:bg-[#0754d6] disabled:opacity-60"
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
                  <div className="bg-[#e6f8fc] p-6 sm:p-7">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0099cb] text-[#0754d6]">
                      <CalendarPlus className="h-5 w-5" />
                    </div>
                    <h2 className="mt-5 text-2xl font-semibold tracking-[-0.025em] text-[#0b1f3a]">
                      Special-case meeting
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-[#5f7187]">
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
                        <Clock3 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7a8b9d]" />
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
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0866ff] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0754d6] disabled:opacity-60"
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
            <div className="flex items-start gap-3 rounded-2xl border border-[#cfe3ff] bg-[#eef6ff] p-4 text-sm leading-6 text-[#2b4966]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0866ff]" />
              <p>{message}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface-card p-5 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#0866ff]">
              Attendance history
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#0b1f3a]">
              {selectedMapping?.group_name ?? "Class meetings"}
            </h2>
          </div>
          <p className="text-sm text-[#6a7c91]">
            {selectedSessions.length} meeting
            {selectedSessions.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {selectedSessions.length ? (
            selectedSessions.map((session) => (
              <article
                key={session.id}
                className="flex flex-col gap-4 rounded-2xl border border-[#dce7f1] bg-[#f8fbff] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6f8fc] text-[#007fa9]">
                    {session.meeting_kind === "special" ? (
                      <CalendarPlus className="h-5 w-5" />
                    ) : (
                      <CalendarDays className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-[#132b48]">
                        {session.title}
                      </h3>
                      <StatusBadge status={session.status} />
                      {session.meeting_kind === "special" ? (
                        <span className="rounded-full bg-[#e6f8fc] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#007fa9]">
                          Special
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[#5f7187]">
                      {formatMeetingDate(
                        session.occurrence_start_at,
                        session.occurrence_date
                      )}
                    </p>
                    <Link
                      href={`/admin/sessions/${session.id}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0866ff] hover:underline"
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
                    className="inline-flex items-center gap-2 rounded-xl border border-[#cbd9e7] bg-white px-3 py-2 text-xs font-semibold text-[#2b4966] transition hover:bg-[#eef6ff] disabled:opacity-50"
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
            <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbff] p-10 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-[#7a8b9d]" />
              <p className="mt-3 font-semibold text-[#17304d]">
                No attendance records yet
              </p>
              <p className="mt-1 text-sm text-[#6a7c91]">
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
      <span className="text-sm font-semibold text-[#29415d]">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function StatusBadge({ status }: { status: SessionRow["status"] }) {
  const style =
    status === "active"
      ? "bg-[#e6f8fc] text-[#007fa9]"
      : status === "cancelled"
        ? "bg-[#fff0ec] text-[#9a4639]"
        : "bg-[#e8eef5] text-[#66798d]";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${style}`}
    >
      {status === "active" ? "Open" : status}
    </span>
  );
}
