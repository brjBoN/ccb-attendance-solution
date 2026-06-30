import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ccbFetch } from "./_ccb-fetch";

const SERVICES = [
  "individual_search",
  "individual_profile_from_id",
  "duplicate_individuals_list",
  "group_profiles",
  "group_profile_from_id",
  "group_participants",
  "individual_groups",
  "event_profiles",
  "event_profile",
  "attendance_profile",
  "attendance_profiles",
  "create_event_attendance",
  "create_group",
  "create_individual",
  "add_individual_to_group"
];

async function main() {
  const outDir = join(process.cwd(), "tmp", "ccb-discovery");
  await mkdir(outDir, { recursive: true });

  const report: Array<{
    service: string;
    ok: boolean;
    error?: string;
    fixturePath?: string;
  }> = [];

  for (const service of SERVICES) {
    try {
      console.log(`describe_api: ${service}`);
      const result = await ccbFetch(service, { describe_api: "1" });
      const fixturePath = join(outDir, `${service}.describe.json`);
      await writeFile(fixturePath, JSON.stringify(result.parsed, null, 2), "utf-8");
      report.push({ service, ok: true, fixturePath });
    } catch (error) {
      report.push({
        service,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const reportPath = join(outDir, "report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");

  console.log(`\nDiscovery report written to ${reportPath}`);
  console.table(report.map(({ service, ok, error }) => ({ service, ok, error: error ? error.slice(0, 80) : "" })));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
