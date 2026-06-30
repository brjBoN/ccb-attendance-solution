import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/auth/admin";
import {
  canCreateGroupsRole,
  canManageSessionForGroup,
  isFullAdminRole
} from "@/lib/auth/permissions";

export async function requireAdminForApi() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { admin: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { admin, response: null };
}

export async function requireFullAdminForApi() {
  const result = await requireAdminForApi();
  if (result.response || !result.admin) return result;
  if (!isFullAdminRole(result.admin.role)) {
    return {
      admin: result.admin,
      response: NextResponse.json({ error: "Full administrator access is required." }, { status: 403 })
    };
  }
  return result;
}

export async function requireGroupCreatorForApi() {
  const result = await requireAdminForApi();
  if (result.response || !result.admin) return result;
  if (!canCreateGroupsRole(result.admin.role)) {
    return {
      admin: result.admin,
      response: NextResponse.json({ error: "Group Manager or Admin access is required." }, { status: 403 })
    };
  }
  return result;
}

export async function requireSessionManagerForApi(sessionId: string) {
  const result = await requireAdminForApi();
  if (result.response || !result.admin) return { ...result, session: null, mapping: null };

  const supabase = createSupabaseAdminClient();
  const { data: session, error: sessionError } = await supabase
    .from("checkin_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return {
      admin: result.admin,
      session: null,
      mapping: null,
      response: NextResponse.json({ error: "Session not found." }, { status: 404 })
    };
  }

  const { data: mapping } = await supabase
    .from("ccb_group_mappings")
    .select("*")
    .eq("ccb_group_id", session.ccb_group_id)
    .maybeSingle();

  if (!mapping || !canManageSessionForGroup(result.admin, mapping)) {
    return {
      admin: result.admin,
      session,
      mapping,
      response: NextResponse.json(
        { error: "Only this group's main leader or a full administrator can manage its QR sessions." },
        { status: 403 }
      )
    };
  }

  return { admin: result.admin, session, mapping, response: null };
}
