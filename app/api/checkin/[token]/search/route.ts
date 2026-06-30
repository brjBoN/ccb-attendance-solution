import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getInternalCheckinSessionByToken } from "@/lib/checkin/session-token";
import { createCcbClient } from "@/lib/ccb/client";
import { toPublicIndividualMatch } from "@/lib/ccb/privacy";
import { CcbClientError } from "@/lib/ccb/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkPublicRateLimit } from "@/lib/security/rate-limit";

const searchSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal(""))
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const rate = await checkPublicRateLimit(request, `search:${token.slice(0, 16)}`);
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
  const parsed = searchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check your search details.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const normalizedFirstName = parsed.data.firstName.trim();
  const normalizedLastName = parsed.data.lastName.trim();

  try {
    const client = createCcbClient();
    const people = await client.searchIndividuals({
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      phone: parsed.data.phone || undefined,
      email: parsed.data.email || undefined
    });

    const supabase = createSupabaseAdminClient();
    await supabase.from("person_search_logs").insert({
      session_id: sessionResult.session.id,
      normalized_first_name: normalizedFirstName.toLowerCase(),
      normalized_last_name: normalizedLastName.toLowerCase(),
      result_count: people.length
    });

    const publicResults = people.slice(0, 20).map(toPublicIndividualMatch);

    return NextResponse.json({
      count: people.length,
      results: publicResults,
      truncated: people.length > publicResults.length
    });
  } catch (error) {
    return NextResponse.json(formatCcbError(error), { status: 500 });
  }
}

function formatCcbError(error: unknown) {
  if (error instanceof CcbClientError) {
    return {
      error: error.message,
      service: error.service,
      status: error.status
    };
  }

  return {
    error: error instanceof Error ? error.message : "Unknown check-in search error."
  };
}
