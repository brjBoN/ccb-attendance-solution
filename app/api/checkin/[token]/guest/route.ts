import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getInternalCheckinSessionByToken } from "@/lib/checkin/session-token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkPublicRateLimit } from "@/lib/security/rate-limit";

const guestSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal(""))
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const rate = await checkPublicRateLimit(request, `guest:${token.slice(0, 16)}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rate.retryAfterSeconds} seconds.` },
      { status: 429 }
    );
  }

  const sessionResult = await getInternalCheckinSessionByToken(token);

  if (!sessionResult.ok) {
    return NextResponse.json(
      { error: sessionResult.message, reason: sessionResult.reason },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = guestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid guest details.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pending_people")
    .insert({
      session_id: sessionResult.session.id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
      status: "pending"
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_type: "public",
    action: "pending_guest_submitted",
    target_type: "pending_people",
    target_id: data.id,
    metadata_json: {
      session_id: sessionResult.session.id
    }
  });

  return NextResponse.json({
    status: "pending_review",
    message: "Thanks. Your information was sent to a leader/admin for review.",
    pendingPerson: data
  });
}
