import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireGroupCreatorForApi } from "@/lib/auth/api";
import {
  findExistingGroupEvents,
  GroupEventDetectionUnavailableError
} from "@/lib/ccb/group-events";
import { CcbClientError } from "@/lib/ccb/types";

const findExistingGroupEventsCached = unstable_cache(
  async (groupId: string) => findExistingGroupEvents(groupId),
  ["ccb-existing-group-events-v1"],
  { revalidate: 120 }
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { response } = await requireGroupCreatorForApi();
  if (response) return response;

  const { groupId } = await params;
  if (!/^\d+$/.test(groupId)) {
    return NextResponse.json({ error: "Invalid CCB group ID." }, { status: 400 });
  }

  try {
    const result = await findExistingGroupEventsCached(groupId);
    if (!result) {
      return NextResponse.json({ error: "CCB group not found." }, { status: 404 });
    }

    return NextResponse.json({
      group: {
        id: result.group.id,
        name: result.group.name,
        mainLeaderId: result.group.mainLeaderId
      },
      results: result.events
    });
  } catch (error) {
    if (error instanceof GroupEventDetectionUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof CcbClientError) {
      return NextResponse.json(
        {
          error:
            error.status === 429
              ? "CCB is temporarily limiting requests. Please try again in a minute."
              : "CCB could not be checked for existing attendance events."
        },
        { status: error.status === 429 ? 503 : 502 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not inspect the CCB group calendar."
      },
      { status: 502 }
    );
  }
}
