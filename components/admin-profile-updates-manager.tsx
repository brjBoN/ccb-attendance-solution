"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Mail, Phone, X } from "lucide-react";

type ProfileUpdateRequest = {
  id: string;
  session_id: string | null;
  ccb_individual_id: string;
  requested_email: string | null;
  requested_mobile_phone: string | null;
  requested_home_phone: string | null;
  status: "pending" | "processing" | "approved" | "rejected";
  created_at: string;
  checkin_sessions?: {
    title: string;
    occurrence_date: string;
  } | null;
  currentProfile: {
    id: string;
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    maskedEmail: string | null;
    maskedMobilePhone: string | null;
    maskedHomePhone: string | null;
    campus: string | null;
  } | null;
};

export function AdminProfileUpdatesManager() {
  const [requests, setRequests] = useState<ProfileUpdateRequest[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [identityVerifiedByRequest, setIdentityVerifiedByRequest] = useState<
    Record<string, boolean>
  >({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const response = await fetch("/api/admin/profile-updates");
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not load profile updates.");
      return;
    }

    setRequests(
      (data.results ?? []).filter(
        (request: ProfileUpdateRequest) =>
          request.status === "pending" || request.status === "processing"
      )
    );
  }

  function approve(request: ProfileUpdateRequest) {
    if (!identityVerifiedByRequest[request.id]) {
      setMessage(
        "Confirm that this request was verified with the person or a group leader."
      );
      return;
    }

    const profileName =
      request.currentProfile?.fullName ||
      [
        request.currentProfile?.firstName,
        request.currentProfile?.lastName
      ]
        .filter(Boolean)
        .join(" ") ||
      `CCB person ${request.ccb_individual_id}`;
    const fields = [
      request.requested_email ? `email to ${request.requested_email}` : null,
      request.requested_mobile_phone
        ? `mobile phone to ${request.requested_mobile_phone}`
        : null,
      request.requested_home_phone
        ? `home phone to ${request.requested_home_phone}`
        : null
    ]
      .filter(Boolean)
      .join(" and ");
    const confirmed = window.confirm(
      `Apply ${fields} to ${profileName}?`
    );
    if (!confirmed) return;

    startTransition(async () => {
      setMessage("Applying the approved change to CCB...");
      const response = await fetch(
        `/api/admin/profile-updates/${request.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ identityVerified: true })
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Could not update the CCB profile.");
        await load();
        return;
      }

      setMessage("The CCB profile was updated.");
      await load();
    });
  }

  function reject(request: ProfileUpdateRequest) {
    const profileName =
      request.currentProfile?.fullName ||
      `CCB person ${request.ccb_individual_id}`;
    const confirmed = window.confirm(
      `Reject the profile update for ${profileName}?`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const response = await fetch(
        `/api/admin/profile-updates/${request.id}/reject`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Could not reject this profile update.");
        await load();
        return;
      }

      setMessage("The profile update request was rejected.");
      await load();
    });
  }

  return (
    <div className="space-y-5">
      {message ? (
        <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
          {message}
        </p>
      ) : null}

      {requests.length ? (
        requests.map((request) => {
          const session = Array.isArray(request.checkin_sessions)
            ? request.checkin_sessions[0]
            : request.checkin_sessions;

          return (
            <article
              key={request.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-950">
                      {request.currentProfile?.fullName ||
                        [
                          request.currentProfile?.firstName,
                          request.currentProfile?.lastName
                        ]
                          .filter(Boolean)
                          .join(" ") ||
                        `CCB person ${request.ccb_individual_id}`}
                    </h2>
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                      {request.status === "processing"
                        ? "Updating"
                        : identityVerifiedByRequest[request.id]
                          ? "Identity confirmed"
                          : "Identity not verified"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    CCB ID {request.ccb_individual_id}
                  </p>

                  {request.currentProfile ? (
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Current CCB details:{" "}
                      {[
                        request.currentProfile.maskedEmail,
                        request.currentProfile.maskedMobilePhone,
                        request.currentProfile.maskedHomePhone,
                        request.currentProfile.campus
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No contact details"}
                    </p>
                  ) : (
                    <p className="mt-2 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-800">
                      CCB could not verify this profile. Do not approve until
                      the CCB ID is checked manually.
                    </p>
                  )}

                  <dl className="mt-4 space-y-2 text-sm">
                    {request.requested_email ? (
                      <div className="flex items-start gap-2">
                        <Mail className="mt-0.5 h-4 w-4 text-[#0866ff]" />
                        <div>
                          <dt className="font-semibold text-slate-700">
                            New email
                          </dt>
                          <dd className="break-all text-slate-600">
                            {request.requested_email}
                          </dd>
                        </div>
                      </div>
                    ) : null}
                    {request.requested_mobile_phone ? (
                      <div className="flex items-start gap-2">
                        <Phone className="mt-0.5 h-4 w-4 text-[#0866ff]" />
                        <div>
                          <dt className="font-semibold text-slate-700">
                            New mobile phone
                          </dt>
                          <dd className="text-slate-600">
                            {request.requested_mobile_phone}
                          </dd>
                        </div>
                      </div>
                    ) : null}
                    {request.requested_home_phone ? (
                      <div className="flex items-start gap-2">
                        <Phone className="mt-0.5 h-4 w-4 text-[#0866ff]" />
                        <div>
                          <dt className="font-semibold text-slate-700">
                            New home phone
                          </dt>
                          <dd className="text-slate-600">
                            {request.requested_home_phone}
                          </dd>
                        </div>
                      </div>
                    ) : null}
                  </dl>

                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    {session?.title ?? "Unknown meeting"}
                    {session?.occurrence_date
                      ? ` · ${session.occurrence_date}`
                      : ""}
                    {" · "}
                    {new Date(request.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="w-full space-y-3 lg:max-w-sm">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#b9d6ff] bg-[#f3f8ff] p-3 text-sm leading-5 text-[#294c70]">
                    <input
                      type="checkbox"
                      checked={identityVerifiedByRequest[request.id] === true}
                      onChange={(event) =>
                        setIdentityVerifiedByRequest((current) => ({
                          ...current,
                          [request.id]: event.target.checked
                        }))
                      }
                      disabled={isPending || request.status !== "pending"}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#8dbdff] text-[#0866ff] focus:ring-[#0866ff] disabled:opacity-60"
                    />
                    <span>
                      I confirmed this request with the person or a group
                      leader.
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => approve(request)}
                      disabled={
                        isPending ||
                        request.status !== "pending" ||
                        !request.currentProfile ||
                        !identityVerifiedByRequest[request.id]
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-[#0866ff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0754d6] disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" />
                      Apply to CCB
                    </button>
                    <button
                      type="button"
                      onClick={() => reject(request)}
                      disabled={isPending || request.status !== "pending"}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-950">
            No profile updates need review
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Contact corrections submitted during check-in will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
