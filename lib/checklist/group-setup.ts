import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type Metadata = Record<string, unknown>;
type ChecklistStatus = "pending" | "complete" | "not_applicable" | "needs_review";

type ChecklistSeed = {
  checklist_key: string;
  label: string;
  intended_value: unknown;
  instructions: string;
  status: ChecklistStatus;
  required_for_qr: boolean;
  sort_order: number;
};

function has(metadata: Metadata, key: string) {
  return Object.prototype.hasOwnProperty.call(metadata, key);
}

function checkboxGroup(metadata: Metadata, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, Boolean(metadata[key])]));
}

export function buildGroupSetupChecklist(metadata: Metadata = {}): ChecklistSeed[] {
  const attendanceGroupings = Array.isArray(metadata.attendanceGroupings)
    ? metadata.attendanceGroupings
    : [];
  const publicSignupFormId = String(metadata.publicSignupFormId ?? "").trim();
  const monthsOldStart = String(metadata.monthsOldStart ?? "").trim();
  const monthsOldEnd = String(metadata.monthsOldEnd ?? "").trim();
  const searchId = String(metadata.searchId ?? "").trim();

  return [
    {
      checklist_key: "attendance_groupings",
      label: "Attendance Groupings",
      intended_value: { selected: attendanceGroupings },
      instructions:
        "Open the group in CCB and set the Attendance/Event Groupings to match the selected values. This is required before relying on QR attendance reporting.",
      status: attendanceGroupings.length ? "pending" : "needs_review",
      required_for_qr: true,
      sort_order: 10
    },
    {
      checklist_key: "leader_privileges",
      label: "Group Leader Privileges",
      intended_value: checkboxGroup(metadata, [
        "leadersCanEdit",
        "leadersCanEditParticipants",
        "leadersCanUpdateProfiles",
        "leadersCanGiveLogins",
        "leadersCanAccessFamilyReports",
        "leadersCanPubToChurchCal",
        "leadersCanBookResources",
        "leadersCanUploadDocs"
      ]),
      instructions:
        "Open the group's leader privilege settings in CCB and make each privilege match the intended values.",
      status: "pending",
      required_for_qr: false,
      sort_order: 20
    },
    {
      checklist_key: "member_privileges",
      label: "Group Member Privileges",
      intended_value: checkboxGroup(metadata, [
        "prefMemberStartTopic",
        "prefMemberCreateNeed",
        "prefMemberUploadDoc"
      ]),
      instructions:
        "Open the group member privilege settings in CCB and make each privilege match the intended values.",
      status: "pending",
      required_for_qr: false,
      sort_order: 30
    },
    {
      checklist_key: "communication_defaults",
      label: "Participant Communication Defaults",
      intended_value: checkboxGroup(metadata, [
        "prefDefaultMessages",
        "prefDefaultComments",
        "prefDefaultDigest",
        "prefDefaultText"
      ]),
      instructions:
        "Open participant communication defaults in CCB and apply the intended email, comment, digest, and text settings.",
      status: "pending",
      required_for_qr: false,
      sort_order: 40
    },
    {
      checklist_key: "use_for_insights",
      label: "Use for Insights",
      intended_value: { enabled: Boolean(metadata.useForInsights) },
      instructions:
        "Open the group settings in CCB and confirm whether this group should be included in Insights.",
      status: has(metadata, "useForInsights") ? "pending" : "needs_review",
      required_for_qr: false,
      sort_order: 50
    },
    {
      checklist_key: "leader_notifications",
      label: "Leader Join/Leave Notifications",
      intended_value: { enabled: Boolean(metadata.notification) },
      instructions:
        "Open the group settings in CCB and confirm whether leaders receive email when participants join or leave.",
      status: has(metadata, "notification") ? "pending" : "needs_review",
      required_for_qr: false,
      sort_order: 60
    },
    {
      checklist_key: "public_form",
      label: "Public Signup Form",
      intended_value: { form_id: publicSignupFormId || null },
      instructions:
        "If a public form was selected, attach that form to the group in CCB. Otherwise mark this item Not Applicable.",
      status: publicSignupFormId ? "pending" : "not_applicable",
      required_for_qr: false,
      sort_order: 70
    },
    {
      checklist_key: "age_range",
      label: "Age Range",
      intended_value: {
        months_old_start: monthsOldStart || null,
        months_old_end: monthsOldEnd || null
      },
      instructions:
        "If an age range was supplied, enter it in the CCB group settings. Otherwise mark this item Not Applicable.",
      status: monthsOldStart || monthsOldEnd ? "pending" : "not_applicable",
      required_for_qr: false,
      sort_order: 80
    },
    {
      checklist_key: "approval_group",
      label: "Rooms/Resources Approval Group",
      intended_value: { enabled: Boolean(metadata.resourceApprovalGroup) },
      instructions:
        "If enabled, configure the group in CCB as an approval group for rooms/resources. Otherwise mark Not Applicable.",
      status: Boolean(metadata.resourceApprovalGroup) ? "pending" : "not_applicable",
      required_for_qr: false,
      sort_order: 90
    },
    {
      checklist_key: "saved_search",
      label: "Cross-Reference Saved Search",
      intended_value: { search_id: searchId || null },
      instructions:
        "If a saved search ID was supplied, configure the cross-reference in CCB. Otherwise mark Not Applicable.",
      status: searchId ? "pending" : "not_applicable",
      required_for_qr: false,
      sort_order: 100
    },
    {
      checklist_key: "inactive_status",
      label: "Inactive Status",
      intended_value: { inactive: Boolean(metadata.inactive) },
      instructions:
        "Confirm the intended active/inactive state in CCB. New groups normally remain active.",
      status: Boolean(metadata.inactive) ? "pending" : "not_applicable",
      required_for_qr: false,
      sort_order: 110
    }
  ];
}

export async function ensureGroupSetupChecklist(
  supabase: SupabaseClient,
  input: { groupMappingId: string; ccbGroupId: string; metadata?: Metadata }
) {
  const { data: existing, error: existingError } = await supabase
    .from("ccb_group_setup_checklist")
    .select("checklist_key")
    .eq("group_mapping_id", input.groupMappingId);

  if (existingError) throw new Error(existingError.message);

  const existingKeys = new Set((existing ?? []).map((row) => row.checklist_key));
  const rows = buildGroupSetupChecklist(input.metadata ?? {})
    .filter((row) => !existingKeys.has(row.checklist_key))
    .map((row) => ({
      ...row,
      group_mapping_id: input.groupMappingId,
      ccb_group_id: input.ccbGroupId
    }));

  if (!rows.length) return { inserted: 0 };

  const { error } = await supabase.from("ccb_group_setup_checklist").insert(rows);
  if (error) throw new Error(error.message);
  return { inserted: rows.length };
}
