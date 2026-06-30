"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  Loader2,
  Search,
  UserCheck,
  UserPlus,
  UserRoundX
} from "lucide-react";

type PublicMatch = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  maskedEmail: string | null;
  maskedMobilePhone: string | null;
  maskedHomePhone: string | null;
  campus: string | null;
  status: string | null;
};

type SearchResponse = {
  count: number;
  results: PublicMatch[];
  truncated?: boolean;
  error?: string;
};

type SubmitResponse = {
  status: string;
  message: string;
  error?: string;
};

export function PublicCheckinForm({ token }: { token: string }) {
  const [mode, setMode] = useState<"search" | "guest">("search");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [results, setResults] = useState<PublicMatch[]>([]);
  const [selected, setSelected] = useState<PublicMatch | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [finalMessage, setFinalMessage] = useState<string | null>(null);
  const [wasSuccessful, setWasSuccessful] = useState(false);
  const [isPending, startTransition] = useTransition();

  const optionalContact = useMemo(() => {
    const value = phoneOrEmail.trim();
    if (!value) return {};
    if (value.includes("@")) return { email: value };
    return { phone: value };
  }, [phoneOrEmail]);

  function searchPeople(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      setMessage("Searching CCB...");
      setFinalMessage(null);
      setWasSuccessful(false);
      setSelected(null);
      setResults([]);

      const response = await fetch(`/api/checkin/${encodeURIComponent(token)}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          firstName,
          lastName,
          ...optionalContact
        })
      });

      const data = (await response.json()) as SearchResponse;

      if (!response.ok) {
        setMessage(data.error ?? "Could not search for your profile.");
        return;
      }

      setResults(data.results ?? []);

      if (!data.results?.length) {
        setMessage("No matching profiles were found. Use “I don’t see myself / I’m new” below.");
        return;
      }

      if (data.truncated) {
        setMessage(
          `Found ${data.count} possible matches. Showing the first ${data.results.length}. Add phone/email if you need to narrow it down.`
        );
      } else {
        setMessage(`Found ${data.count} possible match${data.count === 1 ? "" : "es"}. Select yourself below.`);
      }
    });
  }

  function submitCheckin(match: PublicMatch) {
    startTransition(async () => {
      setSelected(match);
      setMessage("Submitting check-in...");
      setFinalMessage(null);
      setWasSuccessful(false);

      const response = await fetch(`/api/checkin/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ccbIndividualId: match.id,
          displayName: match.fullName ?? [match.firstName, match.lastName].filter(Boolean).join(" "),
          idempotencyKey: `${token.slice(0, 12)}:${match.id}`
        })
      });

      const data = (await response.json()) as SubmitResponse;

      if (!response.ok) {
        setFinalMessage(data.error ?? "Could not submit your check-in.");
        setWasSuccessful(false);
        return;
      }

      setFinalMessage(data.message);
      setWasSuccessful(true);
    });
  }

  function submitGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      setMessage("Submitting guest information...");
      setFinalMessage(null);
      setWasSuccessful(false);

      const response = await fetch(`/api/checkin/${encodeURIComponent(token)}/guest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: guestPhone,
          email: guestEmail,
          notes: guestNotes
        })
      });

      const data = (await response.json()) as SubmitResponse;

      if (!response.ok) {
        setFinalMessage(data.error ?? "Could not submit guest information.");
        return;
      }

      setFinalMessage(data.message);
      setWasSuccessful(true);
    });
  }

  if (wasSuccessful) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-emerald-950">
          {mode === "guest" ? "Sent for review" : "Check-in complete"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-emerald-900">{finalMessage}</p>
        {selected ? (
          <p className="mt-3 text-xs text-emerald-800">
            Selected: {selected.fullName ?? [selected.firstName, selected.lastName].filter(Boolean).join(" ")}
          </p>
        ) : null}
      </div>
    );
  }

  if (mode === "guest") {
    return (
      <div className="mt-6">
        <form onSubmit={submitGuest} className="space-y-4">
          <div className="rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">
            Use this if you do not see your name or you are new. A leader/admin will review it before creating or linking a CCB record.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">First name</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                autoComplete="given-name"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Last name</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                autoComplete="family-name"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Mobile phone</span>
            <input
              value={guestPhone}
              onChange={(event) => setGuestPhone(event.target.value)}
              autoComplete="tel"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              value={guestEmail}
              onChange={(event) => setGuestEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Optional note</span>
            <textarea
              value={guestNotes}
              onChange={(event) => setGuestNotes(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
            />
          </label>

          <button
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Send to leader/admin
          </button>

          <button
            type="button"
            onClick={() => setMode("search")}
            className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to name search
          </button>
        </form>

        {message ? <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
        {finalMessage ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{finalMessage}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <form onSubmit={searchPeople} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">First name</span>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
              autoComplete="given-name"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Last name</span>
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
              autoComplete="family-name"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Phone or email <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <input
            value={phoneOrEmail}
            onChange={(event) => setPhoneOrEmail(event.target.value)}
            placeholder="Helps narrow down duplicate names"
            autoComplete="email"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
          />
        </label>

        <button
          disabled={isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Find me
        </button>
      </form>

      {message ? (
        <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm leading-6 text-slate-700">
          {message}
        </p>
      ) : null}

      {finalMessage && !wasSuccessful ? (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-800">
          {finalMessage}
        </p>
      ) : null}

      {results.length ? (
        <div className="mt-5 space-y-3">
          <h2 className="font-semibold text-slate-950">Select your profile</h2>
          {results.map((match) => (
            <div key={match.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">
                    {match.fullName ?? [match.firstName, match.lastName].filter(Boolean).join(" ")}
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    {match.maskedEmail ? <p>Email: {match.maskedEmail}</p> : null}
                    {match.maskedMobilePhone ? <p>Mobile: {match.maskedMobilePhone}</p> : null}
                    {match.maskedHomePhone ? <p>Home: {match.maskedHomePhone}</p> : null}
                    {match.campus ? <p>Campus: {match.campus}</p> : null}
                    {match.status ? <p>Status: {match.status}</p> : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => submitCheckin(match)}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  <UserCheck className="h-4 w-4" />
                  This is me
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4 text-center">
        <UserRoundX className="mx-auto h-6 w-6 text-slate-400" />
        <p className="mt-2 text-sm font-medium text-slate-800">Do not see yourself?</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Submit your info for leader/admin review.
        </p>
        <button
          type="button"
          onClick={() => setMode("guest")}
          className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          I don’t see myself / I’m new
        </button>
      </div>
    </div>
  );
}
