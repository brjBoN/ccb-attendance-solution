import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFullAdminForApi } from "@/lib/auth/api";
import { deleteAppCreatedGroup } from "@/lib/groups/delete-app-created-group";

const schema = z.object({
  confirmationText: z.string().min(1)
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, response } = await requireFullAdminForApi();
  if (response || !admin) return response;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Deletion requires explicit confirmation text." },
      { status: 400 }
    );
  }

  try {
    const result = await deleteAppCreatedGroup({
      mappingId: id,
      requestedByAdminId: admin.id,
      confirmationText: parsed.data.confirmationText
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown group deletion error." },
      { status: 500 }
    );
  }
}
