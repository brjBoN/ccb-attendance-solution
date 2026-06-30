import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth/api";
import { createCcbClient } from "@/lib/ccb/client";
import { CcbClientError } from "@/lib/ccb/types";

export async function GET(request: NextRequest) {
  const { response } = await requireAdminForApi();
  if (response) return response;

  const service = request.nextUrl.searchParams.get("service");
  if (!service) {
    return NextResponse.json({ error: "Missing service query parameter." }, { status: 400 });
  }

  try {
    const client = createCcbClient();
    const data = await client.describe(service);
    return NextResponse.json({ service, data });
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
