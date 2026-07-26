import { CcbAdminTools } from "@/components/ccb-admin-tools";
import { requireFullAdmin } from "@/lib/auth/admin";
import { getServerEnv } from "@/lib/env";

export default async function AdminSettingsPage() {
  await requireFullAdmin();
  const env = getServerEnv();
  const rows = [
    ["CCB API URL", env.CCB_API_URL],
    ["App Base URL", env.APP_BASE_URL],
    ["CCB create/update writes", "Enabled"],
    ["CCB deletion/removal/inactivation", "Blocked"]
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight text-slate-950">Settings</h1>
      <p className="mt-2 max-w-3xl text-slate-600">Server-side configuration summary. Secrets are intentionally not displayed.</p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm"><tbody>{rows.map(([label, value]) => <tr key={label} className="border-b border-slate-100 last:border-0"><th className="w-64 bg-slate-50 px-4 py-3 font-semibold text-slate-700">{label}</th><td className="px-4 py-3 text-slate-700">{value}</td></tr>)}</tbody></table>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">CCB service checks</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{`npm run ccb:describe -- create_event\nnpm run ccb:describe -- create_event_attendance\nnpm run ccb:describe -- create_individual\nnpm run ccb:describe -- add_individual_to_group`}</pre>
      </div>

      <CcbAdminTools />
    </div>
  );
}
