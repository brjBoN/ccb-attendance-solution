import { ccbFetch } from "./_ccb-fetch";

async function main() {
  const service = process.argv[2];

  if (!service) {
    console.error("Usage: npm run ccb:describe -- <service_name>");
    process.exit(1);
  }

  const result = await ccbFetch(service, { describe_api: "1" });

  console.log(`Read-only describe_api result for service: ${service}`);
  console.log(`URL: ${result.url}`);
  console.log(JSON.stringify(result.parsed, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
