"use client";

import { FormEvent, useState, useTransition } from "react";
import { CheckCircle2, Save } from "lucide-react";
import {
  CCB_AREA_OPTIONS,
  CCB_DEPARTMENT_OPTIONS,
  CCB_GROUP_TYPE_OPTIONS,
  CCB_INTERACTION_TYPE_OPTIONS,
  CCB_MEETING_DAY_OPTIONS,
  CCB_MEETING_TIME_OPTIONS,
  CCB_STATE_OPTIONS
} from "@/lib/ccb/group-create-options";

type EditableGroup = {
  id: string;
  name: string | null;
  description: string | null;
  campusId: string | null;
  groupTypeId: string | null;
  departmentId: string | null;
  areaId: string | null;
  capacity: string | null;
  meetingLocationStreetAddress: string | null;
  meetingLocationCity: string | null;
  meetingLocationState: string | null;
  meetingLocationZip: string | null;
  meetingDayId: string | null;
  meetingTimeId: string | null;
  childcareProvided: boolean | null;
  interactionType: string | null;
  membershipType: string | null;
  notification: boolean | null;
  listed: boolean | null;
  publicSearchListed: boolean | null;
  inactive: boolean | null;
};

export function AdminEditGroupForm({ group }: { group: EditableGroup }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = (name: string) => String(formData.get(name) ?? "").trim();
    const checked = (name: string) => formData.get(name) === "on";

    startTransition(async () => {
      setMessage("Updating group in CCB...");
      setError(null);

      const response = await fetch(`/api/admin/ccb/groups/${encodeURIComponent(group.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: text("name"),
          campusId: text("campusId"),
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
          notification: checked("notification"),
          listed: checked("listed"),
          publicSearchListed: checked("publicSearchListed"),
          udfGroupPulldown1Id: text("udfGroupPulldown1Id"),
          udfGroupPulldown2Id: text("udfGroupPulldown2Id"),
          udfGroupPulldown3Id: text("udfGroupPulldown3Id")
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(null);
        setError(data.error ?? "Could not update the CCB group.");
        return;
      }

      setError(null);
      setMessage(data.message ?? "Group updated in CCB.");
    });
  }

  const membershipOptions: { value: string; label: string }[] = [
    { value: "Open to All", label: "Open to All" },
    { value: "Invitation Required", label: "Invitation Required" },
    { value: "Request Required", label: "Request Required" }
  ];

  if (
    group.membershipType &&
    !membershipOptions.some((option) => option.value === group.membershipType)
  ) {
    membershipOptions.unshift({
      value: group.membershipType,
      label: `${group.membershipType} (keep current)`
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {group.inactive ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950">
          This group is currently inactive in CCB. Saving other fields will leave its inactive status unchanged.
        </div>
      ) : null}

      <Section title="General">
        <Field label="Group name">
          <input name="name" required maxLength={50} defaultValue={group.name ?? ""} className={inputClass} />
        </Field>
        <Field label="Campus ID">
          <input name="campusId" required defaultValue={group.campusId ?? "1"} className={inputClass} />
        </Field>
        <Field label="Description" wide>
          <textarea name="description" rows={5} defaultValue={group.description ?? ""} className={inputClass} />
        </Field>
      </Section>

      <Section title="Classifications">
        <SelectField name="groupTypeId" label="Group type" options={CCB_GROUP_TYPE_OPTIONS} defaultValue={group.groupTypeId ?? ""} />
        <SelectField name="departmentId" label="Department" options={CCB_DEPARTMENT_OPTIONS} defaultValue={group.departmentId ?? ""} />
        <SelectField name="areaId" label="Area" options={CCB_AREA_OPTIONS} defaultValue={group.areaId ?? ""} />
        <Field label="Capacity">
          <input name="groupCapacity" inputMode="numeric" defaultValue={group.capacity === "Unlimited" ? "" : group.capacity ?? ""} className={inputClass} />
        </Field>
      </Section>

      <Section title="Meeting">
        <SelectField name="meetingDayId" label="Meeting day" options={CCB_MEETING_DAY_OPTIONS} defaultValue={group.meetingDayId ?? ""} />
        <SelectField name="meetingTimeId" label="Meeting time" options={CCB_MEETING_TIME_OPTIONS} defaultValue={group.meetingTimeId ?? ""} />
        <Field label="Street address" wide>
          <input name="meetingLocationStreetAddress" defaultValue={group.meetingLocationStreetAddress ?? ""} className={inputClass} />
        </Field>
        <Field label="City">
          <input name="meetingLocationCity" defaultValue={group.meetingLocationCity ?? ""} className={inputClass} />
        </Field>
        <SelectField name="meetingLocationState" label="State" options={CCB_STATE_OPTIONS} defaultValue={group.meetingLocationState ?? ""} />
        <Field label="ZIP">
          <input name="meetingLocationZip" defaultValue={group.meetingLocationZip ?? ""} className={inputClass} />
        </Field>
        <Checkbox name="childcareProvided" label="Childcare provided" defaultChecked={Boolean(group.childcareProvided)} />
      </Section>

      <Section title="Communication and visibility">
        <SelectField name="interactionType" label="Interaction type" options={CCB_INTERACTION_TYPE_OPTIONS} defaultValue={group.interactionType ?? "Announcement Only"} />
        <SelectField name="membershipType" label="Membership type" options={membershipOptions} defaultValue={group.membershipType ?? "Invitation or Request Required"} />
        <Checkbox name="notification" label="Notifications enabled" defaultChecked={Boolean(group.notification)} />
        <Checkbox name="listed" label="Listed" defaultChecked={group.listed !== false} />
        <Checkbox name="publicSearchListed" label="Public search listed" defaultChecked={Boolean(group.publicSearchListed)} />
      </Section>

      <Section title="CCB user-defined pulldowns">
        <Field label="UDF pulldown 1 ID"><input name="udfGroupPulldown1Id" className={inputClass} /></Field>
        <Field label="UDF pulldown 2 ID"><input name="udfGroupPulldown2Id" className={inputClass} /></Field>
        <Field label="UDF pulldown 3 ID"><input name="udfGroupPulldown3Id" className={inputClass} /></Field>
      </Section>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-950">
        This form updates supported CCB fields immediately. It does not expose inactive/delete actions or change the main leader.
      </div>

      <button disabled={isPending} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        <Save className="h-4 w-4" />
        {isPending ? "Saving..." : "Save changes to CCB"}
      </button>

      {message ? (
        <div className="flex gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm text-cyan-950">
          <CheckCircle2 className="h-5 w-5" /> {message}
        </div>
      ) : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div> : null}
    </form>
  );
}

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-950">{title}</h2>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={wide ? "block lg:col-span-2" : "block"}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function SelectField({ name, label, options, defaultValue }: { name: string; label: string; options: readonly { value: string; label: string }[]; defaultValue: string }) {
  return (
    <Field label={label}>
      <select name={name} defaultValue={defaultValue} className={inputClass}>
        {options.map((option, index) => (
          <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>
        ))}
      </select>
    </Field>
  );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}
