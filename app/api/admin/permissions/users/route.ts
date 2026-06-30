import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFullAdminForApi } from "@/lib/auth/api";
import { APP_ROLES } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  authUserId: z.string().uuid(),
  role: z.enum([...APP_ROLES, "none"]),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  ccbIndividualId: z.string().trim().max(40).optional().or(z.literal(""))
});

export async function GET() {
  const { response } = await requireFullAdminForApi();
  if (response) return response;

  const supabase = createSupabaseAdminClient();
  const authUsers = [];
  const perPage = 100;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    authUsers.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }

  const { data: appUsers, error: appError } = await supabase
    .from("admin_users")
    .select("id,auth_user_id,name,email,role,ccb_individual_id,created_at,updated_at");

  if (appError) return NextResponse.json({ error: appError.message }, { status: 500 });

  const byAuthId = new Map((appUsers ?? []).map((row) => [row.auth_user_id, row]));
  return NextResponse.json({
    results: authUsers.map((user) => {
      const appUser = byAuthId.get(user.id);
      return {
        authUserId: user.id,
        email: user.email ?? appUser?.email ?? "",
        emailConfirmedAt: user.email_confirmed_at,
        lastSignInAt: user.last_sign_in_at,
        createdAt: user.created_at,
        name: appUser?.name ?? user.user_metadata?.name ?? null,
        role: appUser?.role ?? "none",
        ccbIndividualId: appUser?.ccb_individual_id ?? null,
        hasAppAccess: Boolean(appUser)
      };
    })
  });
}

export async function PATCH(request: NextRequest) {
  const { admin, response } = await requireFullAdminForApi();
  if (response || !admin) return response;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid permissions payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(input.authUserId);
  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Auth user not found." }, { status: 404 });
  }

  const { data: currentRow } = await supabase
    .from("admin_users")
    .select("*")
    .eq("auth_user_id", input.authUserId)
    .maybeSingle();

  if (currentRow?.role === "owner" && input.role !== "owner") {
    const { count } = await supabase.from("admin_users").select("*", { count: "exact", head: true }).eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "You cannot remove or demote the last owner." }, { status: 409 });
    }
  }

  if (input.role === "none") {
    if (input.authUserId === admin.authUserId) {
      return NextResponse.json({ error: "You cannot remove your own app access." }, { status: 409 });
    }
    const { error } = await supabase.from("admin_users").delete().eq("auth_user_id", input.authUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeAudit(supabase, admin.id, input.authUserId, "none");
    return NextResponse.json({ ok: true, role: "none" });
  }

  const email = authData.user.email;
  if (!email) return NextResponse.json({ error: "Auth user does not have an email." }, { status: 400 });

  const { data, error } = await supabase
    .from("admin_users")
    .upsert(
      {
        auth_user_id: input.authUserId,
        email,
        name: input.name || authData.user.user_metadata?.name || email,
        role: input.role,
        ccb_individual_id: input.ccbIndividualId || null
      },
      { onConflict: "auth_user_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit(supabase, admin.id, input.authUserId, input.role);
  return NextResponse.json({ user: data });
}

async function writeAudit(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  actorId: string,
  targetId: string,
  role: string
) {
  await supabase.from("audit_logs").insert({
    actor_type: "admin",
    actor_id: actorId,
    action: "app_user_permissions_updated",
    target_type: "auth_user",
    target_id: targetId,
    metadata_json: { role }
  });
}
