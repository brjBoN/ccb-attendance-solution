"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { CheckCircle2, Search } from "lucide-react";
import {
  CCB_AREA_OPTIONS,
  CCB_DEPARTMENT_OPTIONS,
  CCB_GROUP_TYPE_OPTIONS,
  CCB_INTERACTION_TYPE_OPTIONS,
  CCB_MEETING_DAY_OPTIONS,
  CCB_MEETING_TIME_OPTIONS,
  CCB_MEMBERSHIP_TYPE_OPTIONS,
  CCB_STATE_OPTIONS,
  CCB_ATTENDANCE_GROUPING_OPTIONS,
  CCB_PUBLIC_FORM_OPTIONS
} from "@/lib/ccb/group-create-options";

type PublicMatch = {
  id: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  maskedEmail: string | null;
  maskedMobilePhone: string | null;
  campus: string | null;
};

type SubmitResult = {
  status?: string;
  message?: string;
  ccbGroupId?: string | null;
  checklistUrl?: string | null;
  checklistCreated?: number;
  error?: string;
};

const defaultPrivileges = {
  prefMemberStartTopic: true,
  prefMemberCreateNeed: true,
  prefMemberUploadDoc: true,
  leadersCanEdit: true,
  leadersCanEditParticipants: true,
  leadersCanUpdateProfiles: false,
  leadersCanGiveLogins: true,
  leadersCanAccessFamilyReports: true,
  leadersCanPubToChurchCal: false,
  leadersCanBookResources: true,
  leadersCanUploadDocs: true
};

export function AdminCreateGroupForm() {
  const [leaderFirst, setLeaderFirst] = useState("");
  const [leaderLast, setLeaderLast] = useState("");
  const [leaderMatches, setLeaderMatches] = useState<PublicMatch[]>([]);
  const [mainLeaderId, setMainLeaderId] = useState("");
  const [mainLeaderName, setMainLeaderName] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function searchLeader(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      setMessage("Searching CCB people for group leader...");
      const response = await fetch("/api/admin/ccb/individuals/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          firstName: leaderFirst,
          lastName: leaderLast
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Could not search leaders.");
        return;
      }

      setLeaderMatches(data.results ?? []);
      setMessage(`Found ${data.count ?? 0} possible leader matches.`);
    });
  }

  function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const checked = (name: string) => formData.get(name) === "on";
    const text = (name: string) => String(formData.get(name) ?? "").trim();

    const attendanceGroupings = formData.getAll("attendanceGroupings").map(String);
    const publicSignupFormId = text("publicSignupFormId");

    const payload = {
      name: text("name"),
      campusId: text("campusId"),
      mainLeaderId: text("mainLeaderId"),
      description: text("description"),
      groupTypeId: text("groupTypeId"),
      departmentId: text("departmentId"),
      areaId: text("areaId"),
      groupCapacity: text("groupCapacity"),
      meetingLocationStreetAddress: text("meetingLocationStreetAddress"),
      meetingLocationCity: text("meetingLocationCity"),
      meetingLocationState: text("meetingLocationState"),
      meetingLocationZip: text("meetingLocationZip"),
      meetingDayId: text("meetingDayId"),
      meetingTimeId: text("meetingTimeId"),
      childcareProvided: checked("childcareProvided"),
      interactionType: text("interactionType"),
      membershipType: text("membershipType"),
      listed: checked("listed"),
      publicSearchListed: checked("publicSearchListed"),
      udfGroupPulldown1Id: text("udfGroupPulldown1Id"),
      udfGroupPulldown2Id: text("udfGroupPulldown2Id"),
      udfGroupPulldown3Id: text("udfGroupPulldown3Id"),
      localOnlyMetadata: {
        publicSignupFormId,
        notification: checked("notification"),
        useForInsights: checked("useForInsights"),
        prefDefaultMessages: checked("prefDefaultMessages"),
        prefDefaultComments: checked("prefDefaultComments"),
        prefDefaultDigest: checked("prefDefaultDigest"),
        prefDefaultText: checked("prefDefaultText"),
        inactive: checked("inactive"),
        monthsOldStart: text("monthsOldStart"),
        monthsOldEnd: text("monthsOldEnd"),
        searchId: text("searchId"),
        resourceApprovalGroup: checked("resourceApprovalGroup"),
        attendanceGroupings,
        ...Object.fromEntries(
          Object.keys(defaultPrivileges).map((key) => [key, checked(key)])
        )
      },
    };

    startTransition(async () => {
      setResult(null);
      setMessage("Submitting create_group request to CCB...");

      const response = await fetch("/api/admin/ccb/groups/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({ error: data.error ?? "Could not create CCB group." });
        setMessage(null);
        return;
      }

      setResult(data);
      setMessage(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm leading-6 text-cyan-950">
        Submitting this form creates a real group in CCB. CCB deletion and inactivation services remain blocked.
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Find main leader</h2>
        <p className="mt-2 text-sm text-slate-600">
          CCB requires a main leader ID to create a group.
        </p>

        <form onSubmit={searchLeader} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={leaderFirst}
            onChange={(event) => setLeaderFirst(event.target.value)}
            placeholder="Leader first name"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            value={leaderLast}
            onChange={(event) => setLeaderLast(event.target.value)}
            placeholder="Leader last name"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <button
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            Search
          </button>
        </form>

        {leaderMatches.length ? (
          <div className="mt-4 space-y-2">
            {leaderMatches.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => {
                  setMainLeaderId(person.id);
                  setMainLeaderName(
                    person.fullName ?? [person.firstName, person.lastName].filter(Boolean).join(" ")
                  );
                }}
                className="block w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"
              >
                <p className="font-semibold text-slate-950">
                  {person.fullName ?? [person.firstName, person.lastName].filter(Boolean).join(" ")}
                </p>
                <p className="text-xs text-slate-500">
                  ID {person.id}
                  {person.maskedEmail ? ` • ${person.maskedEmail}` : ""}
                  {person.maskedMobilePhone ? ` • ${person.maskedMobilePhone}` : ""}
                  {person.campus ? ` • ${person.campus}` : ""}
                </p>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <form onSubmit={submitGroup} className="space-y-6">
        <Section title="General">
          <TextField name="name" label="Group name" maxLength={50} required />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              name="description"
              rows={4}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <TextField name="campusId" label="Campus ID" defaultValue="1" required />
          <TextField
            name="mainLeaderId"
            label="Main leader CCB individual ID"
            value={mainLeaderId}
            onChange={(value) => setMainLeaderId(value)}
            required
            help={mainLeaderName ? `Selected: ${mainLeaderName}` : "Use the leader search above or paste a CCB individual ID."}
          />
          <div className="rounded-xl bg-slate-100 p-3 text-sm leading-6 text-slate-700">
            Group photo upload is available in the CCB web UI, but the documented CCB <code>create_group</code> API does not support uploading the group image during creation.
          </div>
        </Section>

        <Section title="Classifications">
          <SelectField name="groupTypeId" label="Type" options={CCB_GROUP_TYPE_OPTIONS} />
          <SelectField name="departmentId" label="Department" options={CCB_DEPARTMENT_OPTIONS} />
          <CheckboxField name="childcareProvided" label="Childcare Available" />
        </Section>

        <Section title="When this group meets">
          <SelectField name="meetingDayId" label="Meeting Day" options={CCB_MEETING_DAY_OPTIONS} />
          <SelectField name="meetingTimeId" label="Meeting Time" options={CCB_MEETING_TIME_OPTIONS} />
        </Section>

        <Section title="Where this group meets">
          <SelectField name="areaId" label="Area of Town" options={CCB_AREA_OPTIONS} />
          <TextField name="meetingLocationStreetAddress" label="Street" maxLength={150} />
          <TextField name="meetingLocationCity" label="City" maxLength={50} />
          <SelectField name="meetingLocationState" label="State" options={CCB_STATE_OPTIONS} />
          <TextField name="meetingLocationZip" label="Postal Code" maxLength={10} />
        </Section>

        <Section title="Settings">
          <SelectField name="interactionType" label="Interaction Type" options={CCB_INTERACTION_TYPE_OPTIONS} defaultValue="Announcement Only" />
          <SelectField name="membershipType" label="Membership Type" options={CCB_MEMBERSHIP_TYPE_OPTIONS} defaultValue="Invitation or Request Required" />
          <CheckboxField name="listed" label="Listed — let logged-in users see this group" defaultChecked />
          <CheckboxField name="publicSearchListed" label="Public Search — include this group in public group search" />
          <CheckboxField name="notification" label="Email group leaders when participants join or leave on their own" />
          <SelectField name="publicSignupFormId" label="Public Form (added to the admin CCB checklist)" options={CCB_PUBLIC_FORM_OPTIONS} />
          <CheckboxField name="useForInsights" label="Use for Insights (added to the admin CCB checklist)" defaultChecked />
        </Section>

        <Section title="Other">
          <TextField name="groupCapacity" label="Group Participant Limit" help="Blank = Unlimited" />
          <TextField name="monthsOldStart" label="Months Old Range — Start (CCB checklist)" />
          <TextField name="monthsOldEnd" label="Months Old Range — End (CCB checklist)" />
          <TextField name="searchId" label="Cross Reference Saved Search ID (CCB checklist)" />
          <CheckboxField name="resourceApprovalGroup" label="Approval Group — allow group to manage rooms/resources (CCB checklist)" />
          <CheckboxField name="inactive" label="Inactive (CCB checklist)" />
        </Section>

        <Section title="Group Member Privileges (completed through the admin CCB checklist)">
          <CheckboxField name="prefMemberStartTopic" label="Group members can send messages" defaultChecked />
          <CheckboxField name="prefMemberCreateNeed" label="Group members can create new needs" defaultChecked />
          <CheckboxField name="prefMemberUploadDoc" label="Group members can upload files" defaultChecked />
        </Section>

        <Section title="Group Participant Communication Defaults (completed through the admin CCB checklist)">
          <CheckboxField name="prefDefaultMessages" label="Receive emails sent from the group" />
          <CheckboxField name="prefDefaultComments" label="Receive comments immediately" />
          <CheckboxField name="prefDefaultDigest" label="Receive weekly summary of group activity" />
          <CheckboxField name="prefDefaultText" label="Receive texts sent from the group" />
        </Section>

        <Section title="Group Leader Privileges (completed through the admin CCB checklist)">
          <CheckboxField name="leadersCanEdit" label="Edit group settings" defaultChecked />
          <CheckboxField name="leadersCanEditParticipants" label="Add/remove group participants" defaultChecked />
          <CheckboxField name="leadersCanUpdateProfiles" label="Update contact information for group participants" />
          <CheckboxField name="leadersCanGiveLogins" label="Auto-generate usernames and activation links" defaultChecked />
          <CheckboxField name="leadersCanAccessFamilyReports" label="Access group members' family information in reports" defaultChecked />
          <CheckboxField name="leadersCanPubToChurchCal" label="Publish this group's events to church-wide event calendar" />
          <CheckboxField name="leadersCanBookResources" label="Request Rooms & Resources for group events" defaultChecked />
          <CheckboxField name="leadersCanUploadDocs" label="Upload files to this group" defaultChecked />
        </Section>

        <Section title="Attendance groupings (completed through the admin CCB checklist)">
          <div className="grid gap-2 sm:grid-cols-2">
            {CCB_ATTENDANCE_GROUPING_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                <input type="checkbox" name="attendanceGroupings" value={option.value} />
                {option.label}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Create group">
          <div className="lg:col-span-2">
            <button
              disabled={isPending}
              className="rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Create group in CCB
            </button>
          </div>
        </Section>
      </form>

      {message ? (
        <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p>
      ) : null}

      {result?.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-800">
          {result.error}
        </div>
      ) : null}

      {result?.status === "created" ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm leading-6 text-cyan-950">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5" />
            <div>
              <strong>{result.message}</strong>
              {result.ccbGroupId ? <p>CCB Group ID: {result.ccbGroupId}</p> : null}
              <div className="mt-3 flex flex-wrap gap-4">
                <Link href="/admin/sessions" className="inline-flex font-semibold text-cyan-800 underline">
                  Open this group and its permanent QR code
                </Link>
                {result.checklistUrl ? (
                  <Link href={result.checklistUrl} className="inline-flex font-semibold text-cyan-800 underline">
                    Finish CCB setup checklist
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-950">{title}</h2>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

function TextField({
  name,
  label,
  required,
  maxLength,
  defaultValue,
  value,
  onChange,
  help
}: {
  name: string;
  label: string;
  required?: boolean;
  maxLength?: number;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
      />
      {help ? <span className="mt-1 block text-xs text-slate-500">{help}</span> : null}
    </label>
  );
}

function SelectField({
  name,
  label,
  options,
  defaultValue
}: {
  name: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
      >
        {options.map((option) => (
          <option key={`${name}-${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({
  name,
  label,
  defaultChecked
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}
