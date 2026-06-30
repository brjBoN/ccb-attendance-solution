import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth/api";
import { createCcbClient } from "@/lib/ccb/client";
import { CcbClientError } from "@/lib/ccb/types";

export async function GET(request: NextRequest) {
  const { response } = await requireAdminForApi();
  if (response) return response;

  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 100);

  try {
    const client = createCcbClient();
    const groups = await client.listGroups();

    const filtered = query
      ? groups.filter((group) =>
          [group.name, group.description, group.groupType, group.campus, group.leaderName]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        )
      : groups;

    return NextResponse.json({
      count: filtered.length,
      results: filtered.slice(0, limit).map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        groupType: group.groupType,
        campus: group.campus,
        leaderName: group.leaderName,
        mainLeaderId: group.mainLeaderId
      }))
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
