import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canCreateGroupsRole,
  canManageSessionForGroup,
  isFullAdminRole,
  type AppRole
} from "@/lib/auth/permissions";

export type AdminRole = AppRole;

export type CurrentAdmin = {
  id: string;
  authUserId: string;
  email: string;
  name: string | null;
  role: AdminRole;
  ccbIndividualId: string | null;
};

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data, error } = await supabase
    .from("admin_users")
    .select("id,auth_user_id,email,name,role,ccb_individual_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    authUserId: data.auth_user_id,
    email: data.email,
    name: data.name,
    role: data.role as AdminRole,
    ccbIndividualId: data.ccb_individual_id
  };
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}

export async function requireFullAdmin() {
  const admin = await requireAdmin();
  if (!isFullAdminRole(admin.role)) redirect("/admin");
  return admin;
}

export async function requireGroupCreator() {
  const admin = await requireAdmin();
  if (!canCreateGroupsRole(admin.role)) redirect("/admin/groups");
  return admin;
}

export async function requireSessionManager(sessionId: string) {
  const admin = await requireAdmin();
  if (isFullAdminRole(admin.role)) return admin;

  const supabase = createSupabaseAdminClient();
  const { data: session } = await supabase
    .from("checkin_sessions")
    .select("ccb_group_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) redirect("/admin/sessions");

  const { data: mapping } = await supabase
    .from("ccb_group_mappings")
    .select("ccb_main_leader_id")
    .eq("ccb_group_id", session.ccb_group_id)
    .maybeSingle();

  if (!mapping || !canManageSessionForGroup(admin, mapping)) redirect("/admin/sessions");
  return admin;
}
