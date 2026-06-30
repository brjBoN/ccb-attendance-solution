"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Copy, Download, QrCode, RefreshCcw } from "lucide-react";
import { CCB_ATTENDANCE_GROUPING_OPTIONS } from "@/lib/ccb/group-create-options";

type GroupMapping = {
  id: string;
  ccb_group_id: string;
  group_name: string;
  ccb_event_id: string | null;
  ccb_event_grouping_id: string | null;
  auto_add_checkins_to_group: boolean | null;
  enabled: boolean;
};

type SessionRow = {
  id: string;
  title: string;
  ccb_group_id: string;
  ccb_event_id: string;
  occurrence_date: string;
  status: string;
  options?: {
    group_name?: string;
    mapping_id?: string;
    event_grouping_id?: string | null;
    auto_add_checkins_to_group?: boolean;
  };
  checkin_tokens?: Array<{ id: string; revoked_at: string | null }>;
};

type CreatedToken = { checkinUrl: string; qrDataUrl: string };

function toLocalDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function AdminSessionsManager() {
  const [mappings, setMappings] = useState<GroupMapping[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState("");
  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [eventGroupingId, setEventGroupingId] = useState("");
  const [autoAddCheckinsToGroup, setAutoAddCheckinsToGroup] = useState(true);
  const [eventDescription, setEventDescription] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("1");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [numberOfOccurrences, setNumberOfOccurrences] = useState("");
  const [eventListed, setEventListed] = useState(false);
  const [attendanceReminder, setAttendanceReminder] = useState(true);
  const [occurrenceDate, setOccurrenceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startAt, setStartAt] = useState(() => toLocalDateTimeValue(new Date()));
  const [endAt, setEndAt] = useState(() => toLocalDateTimeValue(new Date(Date.now() + 90 * 60 * 1000)));
  const [opensAt, setOpensAt] = useState(() => toLocalDateTimeValue(new Date(Date.now() - 30 * 60 * 1000)));
  const [closesAt, setClosesAt] = useState(() => toLocalDateTimeValue(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedMapping = useMemo(
    () => mappings.find((mapping) => mapping.id === selectedMappingId),
    [mappings, selectedMappingId]
  );

  const selectedGroupingLabel = useMemo(() => {
    return CCB_ATTENDANCE_GROUPING_OPTIONS.find((option) => option.value === eventGroupingId)?.label ?? "";
  }, [eventGroupingId]);

  const loadMappings = useCallback(async () => {
    const response = await fetch("/api/admin/group-mappings?scope=session");
    const data = await response.json();
    const enabled = (data.results ?? []).filter((mapping: GroupMapping) => mapping.enabled);
    setMappings(enabled);
    setSelectedMappingId((current) => current || enabled[0]?.id || "");
  }, []);

  const loadSessions = useCallback(async () => {
    const response = await fetch("/api/admin/sessions");
    const data = await response.json();
    setSessions(data.results ?? []);
  }, []);

  useEffect(() => {
    void loadMappings();
    void loadSessions();
  }, [loadMappings, loadSessions]);

  useEffect(() => {
    if (!selectedMapping) return;
    setEventId(selectedMapping.ccb_event_id ?? "");
    setEventGroupingId(selectedMapping.ccb_event_grouping_id ?? "");
    setAutoAddCheckinsToGroup(selectedMapping.auto_add_checkins_to_group ?? true);
    setTitle(`${selectedMapping.group_name} Check-In`);
  }, [selectedMapping]);

  function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMappingId) {
      setMessage("Select a mapped group first.");
      return;
    }

    if (!eventId && !eventGroupingId) {
      setMessage("Select a CCB Attendance Grouping before creating a new CCB event. This prevents Attendance Grouping = None in CCB.");
      return;
    }

    startTransition(async () => {
      setCreatedToken(null);
      setMessage(eventId ? "Creating QR session..." : "Creating CCB event with attendance grouping, QR session, and token...");

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
          numberOfOccurrences: numberOfOccurrences ? Number(numberOfOccurrences) : null,
          eventListed,
          attendanceReminder,
          eventNotification: false
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not create session.");
        return;
      }

      setCreatedToken({ checkinUrl: data.token.checkinUrl, qrDataUrl: data.token.qrDataUrl });
      setEventId(data.session.ccb_event_id);
      setMessage(
        data.createdEvent
          ? `CCB event ${data.createdEvent.id} was created with attendance grouping ${selectedGroupingLabel || eventGroupingId} and mapped. QR session is ready.`
          : "QR session created. If you selected an existing CCB event, confirm that event already has an Attendance Grouping in CCB."
      );
      await loadMappings();
      await loadSessions();
    });
  }

  function updateStatus(session: SessionRow, status: "active" | "closed" | "cancelled") {
    startTransition(async () => {
      const response = await fetch(`/api/admin/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      setMessage(response.ok ? `Session marked ${status}.` : data.error ?? "Could not update session.");
      if (response.ok) await loadSessions();
    });
  }

  function regenerateToken(session: SessionRow) {
    startTransition(async () => {
      setCreatedToken(null);
      setMessage("Revoking the prior QR token and generating a new one...");
      const response = await fetch(`/api/admin/sessions/${session.id}/tokens`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not regenerate QR token.");
        return;
      }
      setCreatedToken({ checkinUrl: data.token.checkinUrl, qrDataUrl: data.token.qrDataUrl });
      setMessage(`New QR token generated for ${session.title}.`);
      await loadSessions();
    });
  }

  async function copyLink() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken.checkinUrl);
    setMessage("Copied QR check-in link.");
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Create QR check-in session</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Choose an existing CCB event ID, or leave it blank and the app will create and map a CCB event automatically.
        </p>

        <form onSubmit={createSession} className="mt-6 grid gap-4 lg:grid-cols-2">
          <Field label="Mapped group">
            <select
              value={selectedMappingId}
              onChange={(event) => setSelectedMappingId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
            >
              {mappings.map((mapping) => (
                <option key={mapping.id} value={mapping.id}>{mapping.group_name}</option>
              ))}
            </select>
          </Field>

          <Field label="Existing CCB event ID (optional)" help="Leave blank to create a CCB event automatically. Existing events must already have the correct Attendance Grouping set in CCB.">
            <input
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
            />
          </Field>

          <Field label="CCB Attendance Grouping" help="Required when the app creates the CCB event. This fixes the 'Attendance Grouping: None' issue.">
            <select
              value={eventGroupingId}
              onChange={(event) => setEventGroupingId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
            >
              <option value="">Choose attendance grouping...</option>
              {CCB_ATTENDANCE_GROUPING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={autoAddCheckinsToGroup}
              onChange={(event) => setAutoAddCheckinsToGroup(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-semibold text-slate-950">Add checked-in people to the CCB group</span>
              <span className="mt-1 block leading-6">When someone checks in by QR, the app will also add them as a participant of this CCB group.</span>
            </span>
          </label>

          {eventId ? (
            <div className="lg:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5" />
                <p>
                  You entered an existing CCB event ID. The app cannot set that existing event&apos;s Attendance Grouping. Confirm in CCB that this event is not set to Attendance Grouping = None.
                </p>
              </div>
            </div>
          ) : null}

          <Field label="Session / event title" className="lg:col-span-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
            />
          </Field>

          <Field label="Event description" className="lg:col-span-2">
            <textarea
              value={eventDescription}
              onChange={(event) => setEventDescription(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
            />
          </Field>

          <Field label="Occurrence date">
            <input
              type="date"
              value={occurrenceDate}
              onChange={(event) => setOccurrenceDate(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Meeting starts">
              <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </Field>
            <Field label="Meeting ends">
              <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} required className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </Field>
          </div>

          {!eventId ? (
            <div className="grid gap-4 rounded-2xl border border-brand-100 bg-brand-50 p-4 lg:col-span-2 lg:grid-cols-3">
              <Field label="CCB recurrence">
                <select value={recurrenceType} onChange={(event) => setRecurrenceType(event.target.value as typeof recurrenceType)} className="w-full rounded-xl border border-slate-300 px-3 py-2">
                  <option value="none">One-time event</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
              <Field label="Every N periods">
                <input type="number" min="1" max="52" value={recurrenceFrequency} onChange={(event) => setRecurrenceFrequency(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </Field>
              <Field label="Number of occurrences" help="Optional">
                <input type="number" min="1" max="520" value={numberOfOccurrences} onChange={(event) => setNumberOfOccurrences(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </Field>
              <Field label="Recurrence end date" help="Optional">
                <input type="date" value={recurrenceEndDate} onChange={(event) => setRecurrenceEndDate(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </Field>
              <label className="flex items-center gap-2 rounded-xl border border-brand-100 bg-white p-3 text-sm text-slate-700">
                <input type="checkbox" checked={attendanceReminder} onChange={(event) => setAttendanceReminder(event.target.checked)} /> Attendance reminder
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-brand-100 bg-white p-3 text-sm text-slate-700">
                <input type="checkbox" checked={eventListed} onChange={(event) => setEventListed(event.target.checked)} /> List event in CCB
              </label>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
            <Field label="Check-in opens">
              <input type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </Field>
            <Field label="Check-in closes">
              <input type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </Field>
          </div>

          <div className="lg:col-span-2">
            <button disabled={isPending || !mappings.length} className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              Create event/session and QR
            </button>
          </div>
        </form>

        {message ? <p className="mt-5 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}

        {createdToken ? (
          <div className="mt-6 grid gap-5 rounded-2xl border border-brand-100 bg-brand-50 p-5 lg:grid-cols-[260px_1fr]">
            <Image
              src={createdToken.qrDataUrl}
              alt="QR code for check-in"
              width={256}
              height={256}
              unoptimized
              className="h-64 w-64 rounded-xl bg-white p-3 shadow-sm"
            />
            <div>
              <h3 className="font-semibold text-brand-950">QR code created</h3>
              <p className="mt-2 break-all rounded-xl bg-white p-3 text-sm text-brand-900">{createdToken.checkinUrl}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  <Copy className="h-4 w-4" /> Copy link
                </button>
                <a href={createdToken.qrDataUrl} download="ccb-checkin-qr.png" className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                  <Download className="h-4 w-4" /> Download QR
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Existing sessions</h2>
        <div className="mt-5 space-y-3">
          {sessions.length ? sessions.map((session) => {
            const activeTokenCount = session.checkin_tokens?.filter((token) => !token.revoked_at).length ?? 0;
            return (
              <div key={session.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{session.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{session.options?.group_name ?? `Group ${session.ccb_group_id}`} • Event {session.ccb_event_id}</p>
                    <p className="mt-1 text-sm text-slate-600">Occurrence: {session.occurrence_date} • Status: {session.status} • Active tokens: {activeTokenCount}</p>
                    {session.options?.event_grouping_id ? (
                      <p className="mt-1 text-xs text-slate-500">Attendance grouping ID: {session.options.event_grouping_id}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">Auto-add check-ins to group: {session.options?.auto_add_checkins_to_group === false ? "No" : "Yes"}</p>
                    <a href={`/admin/sessions/${session.id}`} className="mt-2 inline-flex text-sm font-semibold text-brand-700 hover:underline">View session dashboard</a>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => regenerateToken(session)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCcw className="h-4 w-4" /> New QR</button>
                    <button type="button" onClick={() => updateStatus(session, session.status === "active" ? "closed" : "active")} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{session.status === "active" ? "Close" : "Activate"}</button>
                    <button type="button" onClick={() => updateStatus(session, "cancelled")} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Cancel</button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <QrCode className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 font-semibold text-slate-950">No sessions yet</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, help, className, children }: { label: string; help?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={className ?? "block"}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
      {help ? <span className="mt-1 block text-xs text-slate-500">{help}</span> : null}
    </label>
  );
}
