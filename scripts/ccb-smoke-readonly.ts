import { ccbFetch } from "./_ccb-fetch";

function readArg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const first = readArg("first");
  const last = readArg("last");

  if (!first || !last) {
    console.error("Usage: npm run ccb:smoke -- --first John --last Smith");
    process.exit(1);
  }

  console.log("Running read-only CCB smoke test...");
  console.log("Service: individual_search");

  const search = await ccbFetch("individual_search", {
    first_name: first,
    last_name: last
  });

  console.log(JSON.stringify(search.parsed, null, 2));

  console.log("\nSmoke test completed. No CCB write services were called.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
