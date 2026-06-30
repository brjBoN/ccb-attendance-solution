import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
