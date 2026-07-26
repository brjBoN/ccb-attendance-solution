"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, Save } from "lucide-react";

type ChecklistStatus = "pending" | "complete" | "not_applicable" | "needs_review";

type ChecklistItem = {
  id: string;
  checklist_key: string;
  label: string;
  intended_value: unknown;
  instructions: string;
  status: ChecklistStatus;
  required_for_qr: boolean;
  sort_order: number;
  notes: string | null;
  completed_at: string | null;
};

type ChecklistGroup = {
  id: string;
  ccb_group_id: string;
  group_name: string;
  ccb_main_leader_id: string | null;
  enabled: boolean;
  ccb_group_setup_checklist: ChecklistItem[];
};

export function AdminCcbChecklist() {
  const [groups, setGroups] = useState<ChecklistGroup[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { status: ChecklistStatus; notes: string }>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [ccbGroupListUrl, setCcbGroupListUrl] = useState("#");
  const [showComplete, setShowComplete] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void load();
  }, []);

  const visibleGroups = useMemo(() => {
    if (showComplete) return groups;
    return groups.filter((group) =>
      group.ccb_group_setup_checklist.some(
        (item) => item.status === "pending" || item.status === "needs_review"
      )
    );
  }, [groups, showComplete]);

  async function load() {
    const response = await fetch("/api/admin/checklist");
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not load CCB checklist.");
      return;
    }

    const nextGroups = (data.results ?? []).map((group: ChecklistGroup) => ({
      ...group,
      ccb_group_setup_checklist: [...(group.ccb_group_setup_checklist ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order
      )
    }));

    setGroups(nextGroups);
    setCcbGroupListUrl(data.ccbGroupListUrl ?? "#");
    setDrafts(
      Object.fromEntries(
        nextGroups.flatMap((group: ChecklistGroup) =>
          group.ccb_group_setup_checklist.map((item) => [
            item.id,
            { status: item.status, notes: item.notes ?? "" }
          ])
        )
      )
    );
  }

  function initialize(group: ChecklistGroup) {
    startTransition(async () => {
      setMessage(`Creating checklist for ${group.group_name}...`);
      const response = await fetch("/api/admin/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappingId: group.id })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not initialize checklist.");
        return;
      }
      setMessage(`Checklist ready for ${group.group_name}.`);
      await load();
    });
  }

  function save(item: ChecklistItem) {
    const draft = drafts[item.id];
    if (!draft) return;

    startTransition(async () => {
      const response = await fetch(`/api/admin/checklist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not update checklist item.");
        return;
      }
      setMessage(`Updated ${item.label}.`);
      await load();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">Finish setup in CCB</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            These settings are not exposed by CCB&apos;s public group API. Apply them in CCB, then record completion here.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={showComplete} onChange={(event) => setShowComplete(event.target.checked)} />
            Show completed groups
          </label>
          <a href={ccbGroupListUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Open CCB Groups <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {message ? <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}

      {visibleGroups.map((group) => {
        const items = group.ccb_group_setup_checklist ?? [];
        const completed = items.filter((item) => item.status === "complete" || item.status === "not_applicable").length;
        const requiredOpen = items.some((item) => item.required_for_qr && item.status !== "complete" && item.status !== "not_applicable");

        return (
          <section key={group.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{group.group_name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  CCB group ID {group.ccb_group_id}
                  {group.ccb_main_leader_id ? ` • Main leader ID ${group.ccb_main_leader_id}` : ""}
                </p>
              </div>
              <div className="text-sm">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{completed} of {items.length} complete</span>
                {requiredOpen ? <span className="ml-2 rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-900">Required QR item open</span> : null}
              </div>
            </div>

            {!items.length ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-center">
                <p className="text-sm text-slate-600">This mapping predates the checklist feature.</p>
                <button type="button" onClick={() => initialize(group)} disabled={isPending} className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  Create checklist
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {items.map((item) => {
                  const draft = drafts[item.id] ?? { status: item.status, notes: item.notes ?? "" };
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto] lg:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-slate-950">{item.label}</h3>
                            {item.required_for_qr ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900">Required for QR readiness</span> : null}
                            {item.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-cyan-600" /> : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{item.instructions}</p>
                          <div className="mt-3 rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Intended value</p>
                            <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">{JSON.stringify(item.intended_value, null, 2)}</pre>
                          </div>
                          <textarea value={draft.notes} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, notes: event.target.value } }))} placeholder="Admin notes" rows={2} className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                        </div>

                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">Status</span>
                          <select value={draft.status} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, status: event.target.value as ChecklistStatus } }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                            <option value="pending">Pending</option>
                            <option value="needs_review">Needs Review</option>
                            <option value="complete">Complete</option>
                            <option value="not_applicable">Not Applicable</option>
                          </select>
                        </label>

                        <button type="button" onClick={() => save(item)} disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                          <Save className="h-4 w-4" /> Save
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
