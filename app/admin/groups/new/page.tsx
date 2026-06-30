import Link from "next/link";
import { AdminCreateGroupForm } from "@/components/admin-create-group-form";
import { requireGroupCreator } from "@/lib/auth/admin";

export default async function NewGroupPage() {
  await requireGroupCreator();
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/groups" className="text-sm font-semibold text-brand-700 hover:underline">← Back to groups</Link>
      <div className="mb-8 mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Create CCB Group</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Create a real group in CCB. Unsupported web-interface settings are automatically added to the admin-only CCB checklist.
        </p>
      </div>
      <AdminCreateGroupForm />
    </div>
  );
}
