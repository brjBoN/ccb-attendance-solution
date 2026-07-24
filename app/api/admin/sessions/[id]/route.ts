import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionManagerForApi } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  status: z.enum(["draft", "active", "closed", "cancelled"]).optional(),
  title: z.string().min(1).optional(),
  checkinOpensAt: z.string().datetime().optional().nullable(),
  checkinClosesAt: z.string().datetime().optional().nullable()
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, response } = await requireSessionManagerForApi(id);
  if (response) return response;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session update payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.checkinOpensAt !== undefined) update.checkin_opens_at = parsed.data.checkinOpensAt || null;
  if (parsed.data.checkinClosesAt !== undefined) update.checkin_closes_at = parsed.data.checkinClosesAt || null;

  const supabase = createSupabaseAdminClient();

  if (parsed.data.status === "active" && session) {
    const { error: closeError } = await supabase
      .from("checkin_sessions")
      .update({ status: "closed" })
      .eq("ccb_group_id", session.ccb_group_id)
      .eq("status", "active")
      .neq("id", id);

    if (closeError) {
      return NextResponse.json({ error: closeError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase.from("checkin_sessions").update(update).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}
