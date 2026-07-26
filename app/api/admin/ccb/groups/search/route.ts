import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdminForApi } from "@/lib/auth/api";
import { createCcbClient } from "@/lib/ccb/client";
import { rankCcbGroups } from "@/lib/ccb/group-search";
import { CcbClientError } from "@/lib/ccb/types";

const listGroupsCached = unstable_cache(
  async () =>
    (await createCcbClient().listGroups()).map((group) => {
      const { raw: _raw, ...safeGroup } = group;
      return safeGroup;
    }),
  ["ccb-group-search-index-v2-sanitized"],
  { revalidate: 300 }
);

export async function GET(request: NextRequest) {
  const { response } = await requireAdminForApi();
  if (response) return response;

  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 100);

  try {
    const groups = await listGroupsCached();
    const ranked = rankCcbGroups(groups, query);

    return NextResponse.json({
      count: ranked.length,
      results: ranked.slice(0, limit).map(({ group, matchReason }) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        groupType: group.groupType,
        campus: group.campus,
        leaderName: group.leaderName,
        mainLeaderId: group.mainLeaderId,
        matchReason
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
