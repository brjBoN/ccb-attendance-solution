"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, Check, Loader2, Pencil, Search, Save, Trash2, X } from "lucide-react";
import { CCB_ATTENDANCE_GROUPING_OPTIONS } from "@/lib/ccb/group-create-options";

type CcbGroupResult = {
  id: string;
  name: string | null;
  description: string | null;
  groupType: string | null;
  campus: string | null;
  leaderName: string | null;
  mainLeaderId: string | null;
  matchReason: "Class name" | "Leader" | "Class type" | "Campus" | "Description";
};

type GroupMapping = {
  id: string;
  ccb_group_id: string;
  group_name: string;
  ccb_event_id: string | null;
  ccb_event_grouping_id: string | null;
  ccb_main_leader_id: string | null;
  auto_add_checkins_to_group: boolean | null;
  created_by_app: boolean;
  deleted_at: string | null;
  enabled: boolean;
  created_at: string;
};

type Draft = {
  eventId: string;
  eventGroupingId: string;
  autoAddCheckinsToGroup: boolean;
};

type ExistingGroupEvent = {
  id: string;
  name: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  recurrence: string | null;
  groupId: string;
  eventGroupingId: string | null;
  eventGroupingName: string | null;
  timeZone: string | null;
  listed: boolean | null;
};

type EnableReview = {
  group: CcbGroupResult;
  mappingId?: string;
  events: ExistingGroupEvent[];
  choice: "existing" | "create_later";
  selectedEventId: string;
  eventGroupingId: string;
  autoAddCheckinsToGroup: boolean;
};

export function AdminGroupsManager({
  canManageGroups,
  canDeleteAppCreatedGroups
}: {
  canManageGroups: boolean;
  canDeleteAppCreatedGroups: boolean;
}) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<CcbGroupResult[]>([]);
  const [mappings, setMappings] = useState<GroupMapping[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [enableReview, setEnableReview] = useState<EnableReview | null>(null);
  const [detectingGroupId, setDetectingGroupId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { void loadMappings(); }, []);

  const mappingByGroupId = useMemo(
    () => new Map(mappings.map((mapping) => [mapping.ccb_group_id, mapping])),
    [mappings]
  );

  async function loadMappings() {
    const response = await fetch("/api/admin/group-mappings");
    const data = await response.json();
    const nextMappings = data.results ?? [];
    setMappings(nextMappings);
    setDrafts((current) => {
      const next = { ...current };
      for (const mapping of nextMappings as GroupMapping[]) {
        next[mapping.ccb_group_id] = next[mapping.ccb_group_id] ?? {
          eventId: mapping.ccb_event_id ?? "",
          eventGroupingId: mapping.ccb_event_grouping_id ?? "",
          autoAddCheckinsToGroup: mapping.auto_add_checkins_to_group ?? true
        };
      }
      return next;
    });
  }

  function setDraft(groupId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [groupId]: {
        eventId: current[groupId]?.eventId ?? "",
        eventGroupingId: current[groupId]?.eventGroupingId ?? "",
        autoAddCheckinsToGroup: current[groupId]?.autoAddCheckinsToGroup ?? true,
        ...patch
      }
    }));
  }

  function draftFor(group: CcbGroupResult, existing?: GroupMapping): Draft {
    return drafts[group.id] ?? {
      eventId: existing?.ccb_event_id ?? "",
      eventGroupingId: existing?.ccb_event_grouping_id ?? "",
      autoAddCheckinsToGroup: existing?.auto_add_checkins_to_group ?? true
    };
  }

  function searchGroups(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setMessage("Searching classes...");
      const response = await fetch(`/api/admin/ccb/groups/search?q=${encodeURIComponent(query)}&limit=75`);
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not search groups.");
        return;
      }
      setGroups(data.results ?? []);
      setMessage(`Found ${data.count ?? 0} matching CCB groups. Showing up to 75.`);
    });
  }

  function beginEnable(group: CcbGroupResult, mapping?: GroupMapping) {
    const draft = draftFor(group, mapping);

    startTransition(async () => {
      setDetectingGroupId(group.id);
      setMessage(`Checking CCB for an existing attendance event for ${group.name ?? "this class"}...`);
      try {
        const response = await fetch(`/api/admin/ccb/groups/${group.id}/events`);
        const data = await response.json();

        if (!response.ok) {
          setMessage(data.error ?? "Could not check CCB for existing attendance events.");
          return;
        }

        const events = (data.results ?? []) as ExistingGroupEvent[];
        const firstEvent = events[0];
        setEnableReview({
          group,
          mappingId: mapping?.id,
          events,
          choice: firstEvent ? "existing" : "create_later",
          selectedEventId: firstEvent?.id ?? "",
          eventGroupingId: firstEvent?.eventGroupingId ?? draft.eventGroupingId,
          autoAddCheckinsToGroup: draft.autoAddCheckinsToGroup
        });
        setMessage(
          firstEvent
            ? `Found ${events.length} existing CCB attendance event${events.length === 1 ? "" : "s"} for this class.`
            : "No existing CCB attendance event was found for this class."
        );
      } catch {
        setMessage("Could not reach the event detector. Nothing was changed; please try again.");
      } finally {
        setDetectingGroupId(null);
      }
    });
  }

  function saveMapping(review: EnableReview) {
    const selectedEvent = review.events.find(
      (event) => event.id === review.selectedEventId
    );

    startTransition(async () => {
      try {
        const response = await fetch(
          review.mappingId
            ? `/api/admin/group-mappings/${review.mappingId}`
            : "/api/admin/group-mappings",
          {
          method: review.mappingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(review.mappingId
              ? {}
              : {
                  ccbGroupId: review.group.id,
                  groupName:
                    review.group.name ?? `CCB Group ${review.group.id}`,
                  ccbMainLeaderId: review.group.mainLeaderId
                }),
            eventChoice: review.choice,
            ccbEventId:
              review.choice === "existing" ? selectedEvent?.id ?? null : null,
            ccbEventGroupingId:
              review.choice === "create_later"
                ? review.eventGroupingId || null
                : selectedEvent?.eventGroupingId ?? null,
            autoAddCheckinsToGroup: review.autoAddCheckinsToGroup,
            enabled: true
          })
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error ?? "Could not save mapping.");
          return;
        }
        setEnableReview(null);
        setMessage(
          selectedEvent
            ? `The existing CCB event “${selectedEvent.name ?? selectedEvent.id}” is connected. Next, save the class’s regular meeting times on the Meetings page.`
            : `QR check-in is enabled for ${data.mapping.group_name}. Its one attendance event will be created when the class schedule is saved.`
        );
        await loadMappings();
      } catch {
        setMessage("Could not finish enabling this class. Nothing was changed; please try again.");
      }
    });
  }

  function updateMapping(mapping: GroupMapping, patch: Partial<{ enabled: boolean }> = {}) {
    const draft = drafts[mapping.ccb_group_id] ?? {
      eventId: mapping.ccb_event_id ?? "",
      eventGroupingId: mapping.ccb_event_grouping_id ?? "",
      autoAddCheckinsToGroup: mapping.auto_add_checkins_to_group ?? true
    };

    startTransition(async () => {
      const response = await fetch(`/api/admin/group-mappings/${mapping.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mapping.ccb_event_id
            ? {}
            : { ccbEventGroupingId: draft.eventGroupingId || null }),
          autoAddCheckinsToGroup: draft.autoAddCheckinsToGroup,
          ...patch
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not update mapping.");
        return;
      }
      setMessage(`Updated mapping for ${data.mapping.group_name}.`);
      await loadMappings();
    });
  }

  function deleteMapping(mapping: GroupMapping) {
    const confirmed = window.confirm(
      `Are you sure you want to delete the local mapping for ${mapping.group_name}? This does not delete the CCB group.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const response = await fetch(`/api/admin/group-mappings/${mapping.id}`, {
        method: "DELETE",
        headers: { "x-confirm-delete": "confirmed" }
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not delete mapping.");
        return;
      }
      setMessage(`Removed mapping for ${mapping.group_name}.`);
      await loadMappings();
    });
  }

  function deleteAppCreatedGroup(mapping: GroupMapping) {
    const expected = `DELETE ${mapping.group_name}`;
    const firstConfirm = window.confirm(
      `This will delete or inactivate the app-created CCB group “${mapping.group_name}”, remove its local QR sessions, check-ins, pending guests, tokens, and checklist entries. This is only allowed because this group was created by the app. Continue?`
    );
    if (!firstConfirm) return;

    const confirmationText = window.prompt(
      `Type exactly this to confirm:

${expected}`
    );
    if (confirmationText !== expected) {
      setMessage("Deletion cancelled. Confirmation text did not match.");
      return;
    }

    startTransition(async () => {
      setMessage(`Deleting app-created group ${mapping.group_name}...`);
      const response = await fetch(`/api/admin/group-mappings/${mapping.id}/delete-created-group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationText })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not delete app-created group.");
        return;
      }

      const eventSummary = (data.ccbEventDeleteResults ?? [])
        .map((event: { eventId: string; status: string }) => `${event.eventId}: ${event.status}`)
        .join(", ");
      setMessage(
        `Deleted local app data and ${data.ccbGroupDeleteStatus} CCB group ${data.ccbGroupId}.` +
          (eventSummary ? ` Event cleanup: ${eventSummary}.` : "")
      );
      await loadMappings();
    });
  }

  const selectedReviewEvent = enableReview?.events.find(
    (event) => event.id === enableReview.selectedEventId
  );
  const canConfirmEnable = Boolean(
    enableReview &&
      (enableReview.choice === "existing"
        ? selectedReviewEvent
        : enableReview.eventGroupingId)
  );

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Search CCB groups</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Search by class name. Leader, type, campus, and description are used as secondary matches, and class-name matches always appear first.
        </p>

        <form onSubmit={searchGroups} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search class names, e.g. Discover..." className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 outline-none ring-brand-500 focus:ring-2" />
          </div>
          <button disabled={isPending} className="rounded-xl bg-brand-600 px-5 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">Search</button>
        </form>

        {message ? <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}

        <div className="mt-5 space-y-3">
          {groups.map((group) => {
            const existing = mappingByGroupId.get(group.id);
            const draft = draftFor(group, existing);
            return (
              <div key={group.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{group.name ?? `CCB Group ${group.id}`}</p>
                    <p className="mt-1 inline-flex rounded-full bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">
                      Matched on {group.matchReason.toLowerCase()}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">CCB group ID: {group.id}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {[group.groupType, group.campus, group.leaderName].filter(Boolean).join(" • ") || "No extra metadata returned."}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Main leader CCB ID: {group.mainLeaderId || "Not returned"}</p>
                  </div>

                  {canManageGroups ? (
                    <div className="w-full max-w-md space-y-3">
                      {existing ? (
                        <>
                          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                            <p className="flex items-center gap-2 text-sm font-semibold text-cyan-950">
                              <Check className="h-4 w-4" /> {
                                !existing.enabled
                                  ? "QR check-in disabled"
                                  : existing.ccb_event_id
                                    ? "QR check-in enabled"
                                    : "QR setup needs class times"
                              }
                            </p>
                            <p className="mt-1 text-xs leading-5 text-cyan-800">
                              {existing.ccb_event_id
                                ? `Using existing CCB attendance event ${existing.ccb_event_id}.`
                                : "The class attendance event will be created when its schedule is saved."}
                            </p>
                          </div>

                          {!existing.ccb_event_id ? (
                            <>
                              <label className="block text-xs font-medium text-slate-600">CCB Attendance Grouping</label>
                              <select value={draft.eventGroupingId} onChange={(event) => setDraft(group.id, { eventGroupingId: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2">
                                <option value="">Choose attendance grouping...</option>
                                {CCB_ATTENDANCE_GROUPING_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm leading-6 text-brand-900">
                          The app will check this class for an existing CCB attendance event before anything is enabled.
                        </div>
                      )}

                      <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                        <input type="checkbox" checked={draft.autoAddCheckinsToGroup} onChange={(event) => setDraft(group.id, { autoAddCheckinsToGroup: event.target.checked })} className="mt-1" />
                        <span>Add QR check-ins to this CCB group as participants</span>
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            existing?.ccb_event_id
                              ? updateMapping(existing)
                              : beginEnable(group, existing)
                          }
                          disabled={isPending}
                          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                          {detectingGroupId === group.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {existing?.ccb_event_id
                            ? "Update class"
                            : detectingGroupId === group.id
                              ? "Checking CCB..."
                              : existing
                                ? "Check CCB and finish setup"
                                : "Enable QR check-in"}
                        </button>
                        <Link href={`/admin/groups/${group.id}/edit`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          <Pencil className="h-4 w-4" /> Edit in CCB
                        </Link>
                        {existing ? (
                          <Link href="/admin/sessions" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            <CalendarDays className="h-4 w-4" /> Set class times
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Enabled classes</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Each enabled class has one permanent QR code. Main-leader linkage controls who may open its meetings.</p>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Group</th><th className="px-4 py-3">CCB IDs / defaults</th><th className="px-4 py-3">Status</th>{canManageGroups ? <th className="px-4 py-3 text-right">Actions</th> : null}</tr>
            </thead>
            <tbody>
              {mappings.length ? mappings.map((mapping) => {
                const draft = drafts[mapping.ccb_group_id] ?? {
                  eventId: mapping.ccb_event_id ?? "",
                  eventGroupingId: mapping.ccb_event_grouping_id ?? "",
                  autoAddCheckinsToGroup: mapping.auto_add_checkins_to_group ?? true
                };

                return (
                  <tr key={mapping.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 font-medium text-slate-950">{mapping.group_name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>Group: {mapping.ccb_group_id}</div>
                      <div>Event: {mapping.ccb_event_id || "Not set"}</div>
                      <div>Attendance grouping: {mapping.ccb_event_grouping_id || "Not set"}</div>
                      <div>Main leader: {mapping.ccb_main_leader_id || "Not linked"}</div>
                      <div>Auto-add check-ins: {mapping.auto_add_checkins_to_group === false ? "No" : "Yes"}</div>
                      <div>Created by app: {mapping.created_by_app ? "Yes" : "No"}</div>
                    </td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{mapping.enabled ? "Enabled" : "Disabled"}</span></td>
                    {canManageGroups ? (
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col gap-2">
                          {!mapping.ccb_event_id ? (
                            <select value={draft.eventGroupingId} onChange={(event) => setDraft(mapping.ccb_group_id, { eventGroupingId: event.target.value })} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">
                              <option value="">Attendance grouping...</option>
                              {CCB_ATTENDANCE_GROUPING_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          ) : null}
                          <label className="flex items-center justify-end gap-2 text-xs text-slate-600">
                            <input type="checkbox" checked={draft.autoAddCheckinsToGroup} onChange={(event) => setDraft(mapping.ccb_group_id, { autoAddCheckinsToGroup: event.target.checked })} /> Auto-add
                          </label>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => updateMapping(mapping)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Save</button>
                            <Link href={`/admin/groups/${mapping.ccb_group_id}/edit`} className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /></Link>
                            <button
                              type="button"
                              onClick={() =>
                                !mapping.enabled && !mapping.ccb_event_id
                                  ? beginEnable(groupResultFromMapping(mapping), mapping)
                                  : updateMapping(mapping, { enabled: !mapping.enabled })
                              }
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {mapping.enabled ? "Disable" : "Enable"}
                            </button>
                            {mapping.created_by_app && canDeleteAppCreatedGroups ? (
                              <button
                                type="button"
                                onClick={() => deleteAppCreatedGroup(mapping)}
                                className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                                title="Delete/inactivate app-created CCB group and clean up local app data"
                              >
                                Delete app group
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => deleteMapping(mapping)}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                                title="Remove local mapping only"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              }) : (
                <tr><td colSpan={canManageGroups ? 4 : 3} className="px-4 py-8 text-center text-slate-500">No group mappings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {enableReview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-review-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/20 bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">
                  Enable QR check-in
                </p>
                <h2 id="event-review-title" className="mt-2 text-2xl font-semibold text-slate-950">
                  {enableReview.events.length
                    ? "Use the attendance event already in CCB?"
                    : "No existing attendance event found"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {enableReview.group.name ?? `CCB Group ${enableReview.group.id}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnableReview(null)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {enableReview.events.length ? (
              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950">
                  CCB already has {enableReview.events.length === 1 ? "an attendance event" : "attendance events"} linked to this exact class. Reusing one keeps attendance together and prevents a duplicate event.
                </div>

                <label className={`block cursor-pointer rounded-2xl border p-4 transition ${
                  enableReview.choice === "existing"
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}>
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="event-choice"
                      checked={enableReview.choice === "existing"}
                      onChange={() => setEnableReview((current) => current ? { ...current, choice: "existing" } : current)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-semibold text-slate-950">Use an existing CCB attendance event</span>
                      <span className="ml-2 rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-cyan-800">
                        Recommended
                      </span>
                    </span>
                  </span>
                </label>

                {enableReview.choice === "existing" ? (
                  <div className="space-y-3 pl-3 sm:pl-8">
                    {enableReview.events.map((event) => (
                      <label
                        key={event.id}
                        className={`block cursor-pointer rounded-2xl border p-4 ${
                          enableReview.selectedEventId === event.id
                            ? "border-brand-400 bg-white shadow-sm"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <span className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="existing-event"
                            checked={enableReview.selectedEventId === event.id}
                            onChange={() => setEnableReview((current) => current ? {
                              ...current,
                              selectedEventId: event.id,
                              eventGroupingId: event.eventGroupingId ?? current.eventGroupingId
                            } : current)}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="block font-semibold text-slate-950">
                              {event.name ?? `CCB event ${event.id}`}
                            </span>
                            <span className="mt-1 block text-sm leading-6 text-slate-600">
                              {event.recurrence ?? formatEventRange(event)}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500">
                              CCB event {event.id}
                              {event.eventGroupingName ? ` · ${event.eventGroupingName}` : ""}
                            </span>
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}

              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
                Nothing was changed in CCB. The app can enable the class now and create its single attendance event only after the regular class schedule is saved.
              </div>
            )}

            {enableReview.choice === "create_later" ? (
              <div className="mt-5">
                <label className="block text-sm font-semibold text-slate-800">
                  CCB Attendance Grouping
                </label>
                <select
                  value={enableReview.eventGroupingId}
                  onChange={(event) => setEnableReview((current) => current ? {
                    ...current,
                    eventGroupingId: event.target.value
                  } : current)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:ring-2"
                >
                  <option value="">Choose attendance grouping...</option>
                  {CCB_ATTENDANCE_GROUPING_OPTIONS.filter((option) => option.value).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={enableReview.autoAddCheckinsToGroup}
                onChange={(event) => setEnableReview((current) => current ? {
                  ...current,
                  autoAddCheckinsToGroup: event.target.checked
                } : current)}
                className="mt-1"
              />
              <span>Add QR check-ins to this CCB group as participants</span>
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEnableReview(null)}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveMapping(enableReview)}
                disabled={isPending || !canConfirmEnable}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                {enableReview.choice === "existing"
                  ? "Use existing event and enable"
                  : "Enable class"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatEventRange(event: ExistingGroupEvent) {
  const start = formatCcbDateTime(event.startDateTime);
  const end = formatCcbDateTime(event.endDateTime);
  if (start && end) return `${start} – ${end}`;
  return start ?? end ?? "Schedule details are not available.";
}

function formatCcbDateTime(value: string | null) {
  const match = value?.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?/
  );
  if (!match) return value;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  const time = new Date(Date.UTC(2000, 0, 1, Number(hour), Number(minute)));
  return `${new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date)} at ${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(time)}`;
}

function groupResultFromMapping(mapping: GroupMapping): CcbGroupResult {
  return {
    id: mapping.ccb_group_id,
    name: mapping.group_name,
    description: null,
    groupType: null,
    campus: null,
    leaderName: null,
    mainLeaderId: mapping.ccb_main_leader_id,
    matchReason: "Class name"
  };
}
