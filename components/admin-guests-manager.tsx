"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { Check, Link2, Search, X } from "lucide-react";

type PendingPerson = {
  id: string;
  session_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  linked_ccb_individual_id: string | null;
  created_ccb_individual_id: string | null;
  created_at: string;
  checkin_sessions?: {
    title: string;
    occurrence_date: string;
  } | null;
};

type Match = {
  id: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  maskedEmail: string | null;
  maskedMobilePhone: string | null;
  campus: string | null;
};

export function AdminGuestsManager() {
  const [pending, setPending] = useState<PendingPerson[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Record<string, Match[]>>({});
  const [manualIds, setManualIds] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const response = await fetch("/api/admin/pending-people");
    const data = await response.json();
    setPending((data.results ?? []).filter((person: PendingPerson) => person.status === "pending"));
  }

  function searchExisting(person: PendingPerson) {
    startTransition(async () => {
      setMessage(`Searching possible CCB matches for ${person.first_name} ${person.last_name}...`);
      const response = await fetch("/api/admin/ccb/individuals/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: person.first_name,
          lastName: person.last_name,
          phone: person.phone ?? undefined,
          email: person.email ?? undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not search existing people.");
        return;
      }

      setSearchResults((prev) => ({ ...prev, [person.id]: data.results ?? [] }));
      setMessage(`Found ${data.count ?? 0} possible matches.`);
    });
  }

  function linkExisting(person: PendingPerson, ccbIndividualId: string) {
    startTransition(async () => {
      setMessage("Linking guest to existing CCB person...");
      const response = await fetch(`/api/admin/pending-people/${person.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ccbIndividualId, submitAttendance: true })
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not link guest.");
        return;
      }

      setMessage(["Guest linked to the existing CCB person.", data.groupAddWarning, data.syncResult?.message].filter(Boolean).join(" "));
      await load();
    });
  }

  function deleteSubmission(person: PendingPerson) {
    const confirmed = window.confirm(
      `Are you sure you want to delete the submission for ${person.first_name} ${person.last_name}? This will remove it from Pending Guests.`
    );

    if (!confirmed) return;

    startTransition(async () => {
      const response = await fetch(`/api/admin/pending-people/${person.id}/reject`, {
        method: "POST",
        headers: { "x-confirm-delete": "confirmed" }
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not delete guest submission.");
        return;
      }

      setMessage("Guest submission deleted.");
      await load();
    });
  }

  function approveCreate(person: PendingPerson) {
    startTransition(async () => {
      setMessage("Creating the CCB person, adding them to the group, and syncing attendance...");
      const response = await fetch(`/api/admin/pending-people/${person.id}/approve-create`, {
        method: "POST"
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not create CCB person.");
        return;
      }

      setMessage(["Guest approved and CCB person created.", data.groupAddWarning, data.syncResult?.message].filter(Boolean).join(" "));
      await load();
    });
  }

  function manualLink(event: FormEvent<HTMLFormElement>, person: PendingPerson) {
    event.preventDefault();
    const ccbIndividualId = manualIds[person.id]?.trim();
    if (!ccbIndividualId) return;
    linkExisting(person, ccbIndividualId);
  }

  return (
    <div className="space-y-5">
      {message ? (
        <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p>
      ) : null}

      {pending.length ? (
        pending.map((person) => {
          const session = Array.isArray(person.checkin_sessions)
            ? person.checkin_sessions[0]
            : person.checkin_sessions;

          return (
            <div key={person.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-950">
                      {person.first_name} {person.last_name}
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {person.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {person.email || "No email"} • {person.phone || "No phone"}
                  </p>
                  {person.notes ? (
                    <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{person.notes}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    Session: {session?.title ?? "Unknown"} {session?.occurrence_date ? `• ${session.occurrence_date}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => searchExisting(person)}
                    disabled={isPending || person.status !== "pending"}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Search className="h-4 w-4" />
                    Search matches
                  </button>
                  <button
                    onClick={() => approveCreate(person)}
                    disabled={isPending || person.status !== "pending"}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    Create CCB person
                  </button>
                  <button
                    onClick={() => deleteSubmission(person)}
                    disabled={isPending || person.status !== "pending"}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>

              {person.status === "pending" ? (
                <form onSubmit={(event) => manualLink(event, person)} className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={manualIds[person.id] ?? ""}
                    onChange={(event) =>
                      setManualIds((prev) => ({ ...prev, [person.id]: event.target.value }))
                    }
                    placeholder="Or paste existing CCB individual ID"
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
                  />
                  <button
                    disabled={isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Link2 className="h-4 w-4" />
                    Link ID
                  </button>
                </form>
              ) : null}

              {searchResults[person.id]?.length ? (
                <div className="mt-4 rounded-2xl border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-950">Possible CCB matches</p>
                  <div className="space-y-2">
                    {searchResults[person.id].map((match) => (
                      <div key={match.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm">
                          <p className="font-semibold text-slate-950">
                            {match.fullName ?? [match.firstName, match.lastName].filter(Boolean).join(" ")}
                          </p>
                          <p className="text-slate-600">
                            ID {match.id}
                            {match.maskedEmail ? ` • ${match.maskedEmail}` : ""}
                            {match.maskedMobilePhone ? ` • ${match.maskedMobilePhone}` : ""}
                            {match.campus ? ` • ${match.campus}` : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => linkExisting(person, match.id)}
                          disabled={isPending}
                          className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                          Link this person
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-950">No pending guest submissions yet</p>
          <p className="mt-2 text-sm text-slate-600">Guest submissions from QR check-in will appear here.</p>
        </div>
      )}
    </div>
  );
}
