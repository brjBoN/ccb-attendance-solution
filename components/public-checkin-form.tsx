"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition
} from "react";
import {
  CheckCircle2,
  Loader2,
  PencilLine,
  Search,
  UserCheck,
  UserPlus,
  UserRoundX
} from "lucide-react";
import {
  readSavedCheckinName,
  savedNameStorageKey,
  type SavedCheckinName,
  writeSavedCheckinName
} from "@/lib/checkin/saved-name";

type PublicMatch = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  maskedEmail: string | null;
  maskedMobilePhone: string | null;
  maskedHomePhone: string | null;
  campus: string | null;
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
  profileUpdateTicket?: string;
};

type ProfileUpdateResponse = {
  status?: string;
  message?: string;
  error?: string;
};

type SearchInput = {
  firstName: string;
  lastName: string;
};

export function PublicCheckinForm({
  token,
  canRememberName
}: {
  token: string;
  canRememberName: boolean;
}) {
  const [mode, setMode] = useState<"search" | "guest">("search");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [results, setResults] = useState<PublicMatch[]>([]);
  const [selected, setSelected] = useState<PublicMatch | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [finalMessage, setFinalMessage] = useState<string | null>(null);
  const [wasSuccessful, setWasSuccessful] = useState(false);
  const [savedName, setSavedName] = useState<SavedCheckinName | null>(null);
  const [usingSavedName, setUsingSavedName] = useState(false);
  const [profileUpdateTicket, setProfileUpdateTicket] = useState<string | null>(
    null
  );
  const [showProfileUpdateForm, setShowProfileUpdateForm] = useState(false);
  const [profileUpdateEmail, setProfileUpdateEmail] = useState("");
  const [profileUpdateMobilePhone, setProfileUpdateMobilePhone] = useState("");
  const [profileUpdateHomePhone, setProfileUpdateHomePhone] = useState("");
  const [profileUpdateMessage, setProfileUpdateMessage] = useState<
    string | null
  >(null);
  const [profileUpdateSent, setProfileUpdateSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const searchRequestRef = useRef<AbortController | null>(null);
  const searchSequenceRef = useRef(0);
  const autoSearchTokenRef = useRef<string | null>(null);
  const autoSearchTimerRef = useRef<number | null>(null);

  const performSearch = useCallback(
    (
      input: SearchInput,
      source: "manual" | "saved" = "manual"
    ) => {
      const normalizedFirstName = input.firstName.trim();
      const normalizedLastName = input.lastName.trim();
      if (!normalizedFirstName || !normalizedLastName) return;

      searchRequestRef.current?.abort();
      const controller = new AbortController();
      const sequence = ++searchSequenceRef.current;
      searchRequestRef.current = controller;

      startTransition(async () => {
        setMessage(
          source === "saved"
            ? "Welcome back — searching with your saved name..."
            : "Searching CCB..."
        );
        setFinalMessage(null);
        setWasSuccessful(false);
        setSelected(null);
        setResults([]);
        setProfileUpdateTicket(null);
        setShowProfileUpdateForm(false);
        setProfileUpdateEmail("");
        setProfileUpdateMobilePhone("");
        setProfileUpdateHomePhone("");
        setProfileUpdateMessage(null);
        setProfileUpdateSent(false);

        try {
          const response = await fetch(
            `/api/checkin/${encodeURIComponent(token)}/search`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                firstName: normalizedFirstName,
                lastName: normalizedLastName
              }),
              signal: controller.signal
            }
          );

          const data = (await response.json()) as SearchResponse;
          if (
            controller.signal.aborted ||
            sequence !== searchSequenceRef.current
          ) {
            return;
          }

          if (!response.ok) {
            setMessage(data.error ?? "Could not search for your profile.");
            return;
          }

          setResults(data.results ?? []);

          if (!data.results?.length) {
            setMessage(
              source === "saved"
                ? "We couldn’t find the name saved on this device. Edit it below and try again."
                : "No matching profiles were found. Use “I don’t see myself / I’m new” below."
            );
            return;
          }

          const welcomePrefix = source === "saved" ? "Welcome back. " : "";
          if (data.truncated) {
            setMessage(
              `${welcomePrefix}Found ${data.count} possible matches. Showing the first ${data.results.length}. If you do not see yourself, ask a leader for help.`
            );
          } else {
            setMessage(
              `${welcomePrefix}Found ${data.count} possible match${data.count === 1 ? "" : "es"}. Select yourself below.`
            );
          }
        } catch {
          if (
            controller.signal.aborted ||
            sequence !== searchSequenceRef.current
          ) {
            return;
          }
          setMessage("Could not search for your profile. Please try again.");
        } finally {
          if (searchRequestRef.current === controller) {
            searchRequestRef.current = null;
          }
        }
      });
    },
    [token]
  );

  useEffect(() => {
    if (autoSearchTimerRef.current !== null) {
      window.clearTimeout(autoSearchTimerRef.current);
      autoSearchTimerRef.current = null;
    }
    searchRequestRef.current?.abort();
    searchRequestRef.current = null;
    searchSequenceRef.current += 1;
    autoSearchTokenRef.current = null;
    setMode("search");
    setFirstName("");
    setLastName("");
    setResults([]);
    setSelected(null);
    setMessage(null);
    setFinalMessage(null);
    setWasSuccessful(false);
    setSavedName(null);
    setUsingSavedName(false);
    setProfileUpdateTicket(null);
    setShowProfileUpdateForm(false);
    setProfileUpdateEmail("");
    setProfileUpdateMobilePhone("");
    setProfileUpdateHomePhone("");
    setProfileUpdateMessage(null);
    setProfileUpdateSent(false);

    let searchWhenVisible: (() => void) | null = null;

    if (canRememberName && savedNameStorageKey(token)) {
      const storage = getBrowserStorage();
      const remembered = storage
        ? readSavedCheckinName(storage, token)
        : null;

      if (remembered) {
        setFirstName(remembered.firstName);
        setLastName(remembered.lastName);
        setSavedName(remembered);
        setUsingSavedName(true);

        const startAutoSearch = () => {
          if (
            document.visibilityState !== "visible" ||
            autoSearchTokenRef.current === token
          ) {
            return;
          }
          autoSearchTokenRef.current = token;
          autoSearchTimerRef.current = window.setTimeout(() => {
            autoSearchTimerRef.current = null;
            performSearch(
              {
                firstName: remembered.firstName,
                lastName: remembered.lastName
              },
              "saved"
            );
          }, 0);
        };
        searchWhenVisible = () => {
          if (document.visibilityState === "visible") {
            if (searchWhenVisible) {
              document.removeEventListener(
                "visibilitychange",
                searchWhenVisible
              );
            }
            startAutoSearch();
          }
        };

        if (document.visibilityState === "visible") {
          startAutoSearch();
        } else {
          document.addEventListener("visibilitychange", searchWhenVisible);
        }
      }
    }

    return () => {
      if (autoSearchTimerRef.current !== null) {
        window.clearTimeout(autoSearchTimerRef.current);
        autoSearchTimerRef.current = null;
      }
      if (searchWhenVisible) {
        document.removeEventListener("visibilitychange", searchWhenVisible);
      }
      searchRequestRef.current?.abort();
      searchRequestRef.current = null;
      searchSequenceRef.current += 1;
      if (autoSearchTokenRef.current === token) {
        autoSearchTokenRef.current = null;
      }
    };
  }, [canRememberName, performSearch, token]);

  function searchPeople(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    performSearch({ firstName, lastName });
  }

  function changeName(field: "first" | "last", value: string) {
    if (autoSearchTimerRef.current !== null) {
      window.clearTimeout(autoSearchTimerRef.current);
      autoSearchTimerRef.current = null;
    }
    autoSearchTokenRef.current = null;
    searchRequestRef.current?.abort();
    searchRequestRef.current = null;
    searchSequenceRef.current += 1;

    if (field === "first") setFirstName(value);
    if (field === "last") setLastName(value);
    setUsingSavedName(false);
    setResults([]);
    setSelected(null);
    setMessage(null);
    setFinalMessage(null);
    setWasSuccessful(false);
    setProfileUpdateTicket(null);
    setShowProfileUpdateForm(false);
    setProfileUpdateEmail("");
    setProfileUpdateMobilePhone("");
    setProfileUpdateHomePhone("");
    setProfileUpdateMessage(null);
    setProfileUpdateSent(false);
  }

  function submitCheckin(match: PublicMatch, openProfileUpdate = false) {
    startTransition(async () => {
      setSelected(match);
      setMessage("Submitting check-in...");
      setFinalMessage(null);
      setWasSuccessful(false);
      setProfileUpdateTicket(null);
      setShowProfileUpdateForm(false);
      setProfileUpdateEmail("");
      setProfileUpdateMobilePhone("");
      setProfileUpdateHomePhone("");
      setProfileUpdateMessage(null);
      setProfileUpdateSent(false);

      try {
        const response = await fetch(
          `/api/checkin/${encodeURIComponent(token)}/submit`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              ccbIndividualId: match.id,
              displayName:
                match.fullName ??
                [match.firstName, match.lastName].filter(Boolean).join(" "),
              idempotencyKey: `${token.slice(0, 12)}:${match.id}`
            })
          }
        );

        const data = (await response.json()) as SubmitResponse;

        if (!response.ok) {
          setFinalMessage(data.error ?? "Could not submit your check-in.");
          setWasSuccessful(false);
          return;
        }

        if (canRememberName) {
          const storage = getBrowserStorage();
          const rememberedFirstName =
            match.firstName?.trim() || firstName.trim();
          const rememberedLastName =
            match.lastName?.trim() || lastName.trim();
          const saved =
            storage &&
            writeSavedCheckinName(storage, token, {
              firstName: rememberedFirstName,
              lastName: rememberedLastName
            });

          if (saved && storage) {
            setSavedName(readSavedCheckinName(storage, token));
            setUsingSavedName(true);
          }
        }

        setProfileUpdateTicket(data.profileUpdateTicket ?? null);
        setShowProfileUpdateForm(
          openProfileUpdate && Boolean(data.profileUpdateTicket)
        );
        setFinalMessage(data.message);
        setWasSuccessful(true);
      } catch {
        setFinalMessage(
          "Could not submit your check-in. Check your connection and try again."
        );
        setWasSuccessful(false);
      }
    });
  }

  function submitProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileUpdateTicket) {
      setProfileUpdateMessage(
        "Check in again to start a new profile update request."
      );
      return;
    }

    startTransition(async () => {
      setProfileUpdateMessage("Sending your update for review...");

      try {
        const response = await fetch(
          `/api/checkin/${encodeURIComponent(token)}/profile-update-request`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              ticket: profileUpdateTicket,
              email: profileUpdateEmail,
              mobilePhone: profileUpdateMobilePhone,
              homePhone: profileUpdateHomePhone
            })
          }
        );
        const data = (await response.json()) as ProfileUpdateResponse;

        if (!response.ok) {
          setProfileUpdateMessage(
            data.error ?? "Could not send your profile update."
          );
          return;
        }

        setProfileUpdateMessage(
          data.message ??
            "Your profile update was sent to an administrator for review."
        );
        setProfileUpdateSent(true);
        setShowProfileUpdateForm(false);
      } catch {
        setProfileUpdateMessage(
          "Could not send your update. Check your connection and try again."
        );
      }
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
      <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-100 text-cyan-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-cyan-950">
          {mode === "guest" ? "Sent for review" : "Check-in complete"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-cyan-900">{finalMessage}</p>
        {selected ? (
          <p className="mt-3 text-xs text-cyan-800">
            Selected: {selected.fullName ?? [selected.firstName, selected.lastName].filter(Boolean).join(" ")}
          </p>
        ) : null}
        {mode === "search" && savedName ? (
          <div className="mt-4 rounded-xl border border-cyan-200 bg-white/70 px-3 py-2.5 text-xs leading-5 text-cyan-900">
            <p>Your name was saved for faster group check-in next time.</p>
          </div>
        ) : null}

        {mode === "search" && selected && profileUpdateTicket ? (
          <div className="mt-4 border-t border-cyan-200 pt-4 text-left">
            {profileUpdateSent ? (
              <p
                className="rounded-xl border border-cyan-200 bg-white/75 p-3 text-sm leading-6 text-cyan-900"
                role="status"
              >
                {profileUpdateMessage}
              </p>
            ) : showProfileUpdateForm ? (
              <form
                onSubmit={submitProfileUpdate}
                className="space-y-3 rounded-2xl border border-cyan-200 bg-white/80 p-4"
              >
                <div>
                  <h3 className="font-semibold text-cyan-950">
                    Update my information
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-cyan-900/75">
                    Enter only what needs to change. An administrator will
                    review it before CCB is updated.
                  </p>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    New mobile phone
                  </span>
                  <input
                    value={profileUpdateMobilePhone}
                    onChange={(event) =>
                      setProfileUpdateMobilePhone(event.target.value)
                    }
                    type="tel"
                    autoComplete="tel"
                    placeholder="Leave blank if unchanged"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    New email
                  </span>
                  <input
                    value={profileUpdateEmail}
                    onChange={(event) =>
                      setProfileUpdateEmail(event.target.value)
                    }
                    type="email"
                    autoComplete="email"
                    placeholder="Leave blank if unchanged"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    New home phone
                  </span>
                  <input
                    value={profileUpdateHomePhone}
                    onChange={(event) =>
                      setProfileUpdateHomePhone(event.target.value)
                    }
                    type="tel"
                    autoComplete="tel"
                    placeholder="Leave blank if unchanged"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
                  />
                </label>

                {profileUpdateMessage ? (
                  <p
                    className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900"
                    role="status"
                  >
                    {profileUpdateMessage}
                  </p>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    disabled={isPending}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0866ff] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0754d6] disabled:opacity-60"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PencilLine className="h-4 w-4" />
                    )}
                    Send update request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileUpdateForm(false);
                      setProfileUpdateMessage(null);
                    }}
                    disabled={isPending}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowProfileUpdateForm(true);
                  setProfileUpdateMessage(null);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#8dbdff] bg-white px-4 py-3 text-sm font-semibold text-[#0754d6]"
              >
                <PencilLine className="h-4 w-4" />
                Update my information
              </button>
            )}
          </div>
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
                onChange={(event) =>
                  changeName("first", event.target.value)
                }
                required
                autoComplete="given-name"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Last name</span>
              <input
                value={lastName}
                onChange={(event) =>
                  changeName("last", event.target.value)
                }
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
      {savedName && usingSavedName ? (
        <div className="mb-4 rounded-2xl border border-[#b9d6ff] bg-[#eef6ff] p-4 text-sm leading-6 text-[#294c70]">
          <p>
            <strong className="text-[#173e68]">Welcome back.</strong>{" "}
            Using the name saved for this group. Edit the name fields below if
            needed.
          </p>
        </div>
      ) : null}

      <form onSubmit={searchPeople} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">First name</span>
            <input
              value={firstName}
              onChange={(event) =>
                changeName("first", event.target.value)
              }
              required
              autoComplete="given-name"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Last name</span>
            <input
              value={lastName}
              onChange={(event) =>
                changeName("last", event.target.value)
              }
              required
              autoComplete="family-name"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none ring-brand-500 focus:ring-2"
            />
          </label>
        </div>

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
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:min-w-[190px]">
                  <button
                    type="button"
                    onClick={() => submitCheckin(match)}
                    disabled={isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    <UserCheck className="h-4 w-4" />
                    This is me
                  </button>
                  <button
                    type="button"
                    onClick={() => submitCheckin(match, true)}
                    disabled={isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#b9d6ff] bg-[#f3f8ff] px-4 py-2.5 text-sm font-semibold text-[#0754d6] hover:bg-[#eaf4ff] disabled:opacity-60"
                  >
                    <PencilLine className="h-4 w-4" />
                    Update my information
                  </button>
                </div>
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

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
