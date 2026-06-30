import "server-only";

import { createCcbClient } from "@/lib/ccb/client";
import { CcbClientError } from "@/lib/ccb/types";

export type GroupMembershipResult =
  | { ok: true; status: "added" | "already_member" | "skipped"; message: string }
  | { ok: false; status: "failed"; message: string };

export async function ensureCcbGroupParticipant(input: {
  individualId: string;
  groupId: string;
  enabled: boolean;
}): Promise<GroupMembershipResult> {
  if (!input.enabled) {
    return {
      ok: true,
      status: "skipped",
      message: "Group auto-add is disabled for this QR session."
    };
  }

  try {
    await createCcbClient().addIndividualToGroup({
      individualId: input.individualId,
      groupId: input.groupId,
      status: "add"
    });

    return {
      ok: true,
      status: "added",
      message: "Added to the CCB group."
    };
  } catch (error) {
    const message =
      error instanceof CcbClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Could not add this person to the CCB group.";

    if (/already|exists|participant|member/i.test(message)) {
      return {
        ok: true,
        status: "already_member",
        message: "Already in the CCB group."
      };
    }

    return {
      ok: false,
      status: "failed",
      message
    };
  }
}
