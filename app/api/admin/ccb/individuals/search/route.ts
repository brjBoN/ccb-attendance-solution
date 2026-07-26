import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGroupCreatorForApi } from "@/lib/auth/api";
import { createCcbClient } from "@/lib/ccb/client";
import { toPublicIndividualMatch } from "@/lib/ccb/privacy";
import { CcbClientError } from "@/lib/ccb/types";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional()
});

export async function POST(request: NextRequest) {
  const { response } = await requireGroupCreatorForApi();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const client = createCcbClient();
    const people = await client.searchIndividuals(parsed.data);
    return NextResponse.json({
      count: people.length,
      results: people.map(toPublicIndividualMatch)
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
    error: error instanceof Error ? error.message : "Unknown error"
  };
}
