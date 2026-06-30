"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Save, Search } from "lucide-react";
import { APP_ROLE_LABELS, APP_ROLES, type AppRole } from "@/lib/auth/permissions";

type PermissionUser = {
  authUserId: string;
  email: string;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  createdAt: string;
  name: string | null;
  role: AppRole | "none";
  ccbIndividualId: string | null;
  hasAppAccess: boolean;
};

export function AdminPermissionsManager() {
  const [users, setUsers] = useState<PermissionUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { role: AppRole | "none"; name: string; ccbIndividualId: string }>>({});
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { void loadUsers(); }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((user) =>
      [user.email, user.name, user.role, user.ccbIndividualId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [query, users]);

  async function loadUsers() {
    const response = await fetch("/api/admin/permissions/users");
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not load users.");
      return;
    }

    setUsers(data.results ?? []);
    setDrafts(Object.fromEntries((data.results ?? []).map((user: PermissionUser) => [
      user.authUserId,
      { role: user.role, name: user.name ?? "", ccbIndividualId: user.ccbIndividualId ?? "" }
    ])));
  }

  function updateDraft(userId: string, patch: Partial<{ role: AppRole | "none"; name: string; ccbIndividualId: string }>) {
    setDrafts((current) => ({ ...current, [userId]: { ...current[userId], ...patch } }));
  }

  function save(user: PermissionUser) {
    const draft = drafts[user.authUserId];
    if (!draft) return;

    startTransition(async () => {
      setMessage(`Saving permissions for ${user.email}...`);
      const response = await fetch("/api/admin/permissions/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authUserId: user.authUserId, ...draft })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not update permissions.");
        return;
      }
      setMessage(`Updated permissions for ${user.email}.`);
      await loadUsers();
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Role definitions</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Role label="Owner / Admin" description="See every sidebar page and manage all groups, QR sessions, guests, checklist items, and permissions." />
          <Role label="Group Manager" description="Can create and edit groups. Cannot view Pending Guests, Permissions, or the CCB Checklist. QR sessions are limited to groups they personally lead." />
          <Role label="Group Leader" description="Can create and manage QR sessions only for groups where their CCB individual ID matches the group's main leader ID." />
          <Role label="No Access" description="The Supabase Auth user remains, but no app authorization row exists." />
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all users by name, email, role, or CCB individual ID" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 outline-none ring-brand-500 focus:ring-2" />
      </div>

      {message ? <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}

      <div className="space-y-3">
        {filtered.map((user) => {
          const draft = drafts[user.authUserId];
          if (!draft) return null;
          return (
            <div key={user.authUserId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-end">
                <div>
                  <p className="font-semibold text-slate-950">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Created {new Date(user.createdAt).toLocaleDateString()}
                    {user.lastSignInAt ? ` • Last sign-in ${new Date(user.lastSignInAt).toLocaleString()}` : ""}
                  </p>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Display name</span>
                  <input value={draft.name} onChange={(event) => updateDraft(user.authUserId, { name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Role</span>
                  <select value={draft.role} onChange={(event) => updateDraft(user.authUserId, { role: event.target.value as AppRole | "none" })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    <option value="none">No Access</option>
                    {APP_ROLES.map((role) => <option key={role} value={role}>{APP_ROLE_LABELS[role]}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">CCB individual ID</span>
                  <input value={draft.ccbIndividualId} onChange={(event) => updateDraft(user.authUserId, { ccbIndividualId: event.target.value })} placeholder="Required for leader QR access" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <button type="button" onClick={() => save(user)} disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  <Save className="h-4 w-4" /> Save
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Role({ label, description }: { label: string; description: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold text-slate-950">{label}</p><p className="mt-1 text-sm leading-6 text-slate-600">{description}</p></div>;
}
