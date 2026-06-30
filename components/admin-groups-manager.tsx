"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { Pencil, Search, Save, Trash2 } from "lucide-react";
import { CCB_ATTENDANCE_GROUPING_OPTIONS } from "@/lib/ccb/group-create-options";

type CcbGroupResult = {
  id: string;
  name: string | null;
  description: string | null;
  groupType: string | null;
  campus: string | null;
  leaderName: string | null;
  mainLeaderId: string | null;
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
      setMessage("Loading CCB groups. This can take a little while on large accounts...");
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

  function saveMapping(group: CcbGroupResult) {
    const draft = draftFor(group, mappingByGroupId.get(group.id));

    startTransition(async () => {
      const response = await fetch("/api/admin/group-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ccbGroupId: group.id,
          groupName: group.name ?? `CCB Group ${group.id}`,
          ccbEventId: draft.eventId || null,
          ccbEventGroupingId: draft.eventGroupingId || null,
          ccbMainLeaderId: group.mainLeaderId,
          autoAddCheckinsToGroup: draft.autoAddCheckinsToGroup,
          enabled: true
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not save mapping.");
        return;
      }
      setMessage(`Saved mapping for ${data.mapping.group_name}.`);
      await loadMappings();
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
          ccbEventId: draft.eventId || null,
          ccbEventGroupingId: draft.eventGroupingId || null,
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

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Search CCB groups</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Search by group name, type, campus, description, or leader. Save the CCB Attendance Grouping default and group auto-add behavior here.
        </p>

        <form onSubmit={searchGroups} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search groups, e.g. small group, Tuesday, leader name..." className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 outline-none ring-brand-500 focus:ring-2" />
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
                    <p className="mt-1 text-xs text-slate-500">CCB group ID: {group.id}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {[group.groupType, group.campus, group.leaderName].filter(Boolean).join(" • ") || "No extra metadata returned."}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Main leader CCB ID: {group.mainLeaderId || "Not returned"}</p>
                  </div>

                  {canManageGroups ? (
                    <div className="w-full max-w-md space-y-3">
                      <label className="block text-xs font-medium text-slate-600">Default CCB event ID, optional</label>
                      <input value={draft.eventId} onChange={(event) => setDraft(group.id, { eventId: event.target.value })} placeholder="Paste CCB event ID" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2" />

                      <label className="block text-xs font-medium text-slate-600">Default CCB Attendance Grouping</label>
                      <select value={draft.eventGroupingId} onChange={(event) => setDraft(group.id, { eventGroupingId: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2">
                        <option value="">Choose attendance grouping...</option>
                        {CCB_ATTENDANCE_GROUPING_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>

                      <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                        <input type="checkbox" checked={draft.autoAddCheckinsToGroup} onChange={(event) => setDraft(group.id, { autoAddCheckinsToGroup: event.target.checked })} className="mt-1" />
                        <span>Add QR check-ins to this CCB group as participants</span>
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => saveMapping(group)} disabled={isPending} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                          <Save className="h-4 w-4" /> {existing ? "Update mapping" : "Enable QR check-in"}
                        </button>
                        <Link href={`/admin/groups/${group.id}/edit`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          <Pencil className="h-4 w-4" /> Edit in CCB
                        </Link>
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
        <h2 className="text-lg font-semibold text-slate-950">Enabled group mappings</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Main-leader linkage controls who may create QR sessions for each group.</p>

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
                          <select value={draft.eventGroupingId} onChange={(event) => setDraft(mapping.ccb_group_id, { eventGroupingId: event.target.value })} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">
                            <option value="">Attendance grouping...</option>
                            {CCB_ATTENDANCE_GROUPING_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <label className="flex items-center justify-end gap-2 text-xs text-slate-600">
                            <input type="checkbox" checked={draft.autoAddCheckinsToGroup} onChange={(event) => setDraft(mapping.ccb_group_id, { autoAddCheckinsToGroup: event.target.checked })} /> Auto-add
                          </label>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => updateMapping(mapping)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Save</button>
                            <Link href={`/admin/groups/${mapping.ccb_group_id}/edit`} className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /></Link>
                            <button type="button" onClick={() => updateMapping(mapping, { enabled: !mapping.enabled })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">{mapping.enabled ? "Disable" : "Enable"}</button>
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
    </div>
  );
}
