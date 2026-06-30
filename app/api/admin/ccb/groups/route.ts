import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth/api";
import { createCcbClient } from "@/lib/ccb/client";
import { CcbClientError } from "@/lib/ccb/types";

export async function GET() {
  const { response } = await requireAdminForApi();
  if (response) return response;

  try {
    const client = createCcbClient();
    const groups = await client.listGroups();
    return NextResponse.json({ count: groups.length, results: groups });
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
