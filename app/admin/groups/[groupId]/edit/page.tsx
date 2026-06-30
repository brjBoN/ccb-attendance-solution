import { requireGroupCreator } from "@/lib/auth/admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminEditGroupForm } from "@/components/admin-edit-group-form";
import { createCcbClient } from "@/lib/ccb/client";

export const dynamic = "force-dynamic";

export default async function EditGroupPage({
  params
}: {
  params: Promise<{ groupId: string }>;
}) {
  await requireGroupCreator();
  const { groupId } = await params;
  const group = await createCcbClient().getGroupProfile({ groupId });
  if (!group) notFound();

  const { raw: _raw, ...editableGroup } = group;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/groups" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to groups
      </Link>
      <div className="my-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Edit CCB Group</h1>
        <p className="mt-2 text-slate-600">
          CCB group ID {group.id}. Saving writes the supported fields directly to CCB.
        </p>
      </div>
      <AdminEditGroupForm group={editableGroup} />
    </div>
  );
}
