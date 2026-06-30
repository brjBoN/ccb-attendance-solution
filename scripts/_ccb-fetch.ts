import { XMLParser } from "fast-xml-parser";
import { getScriptEnv } from "./_env";

export async function ccbFetch(service: string, params: Record<string, string> = {}) {
  const env = getScriptEnv();
  const url = new URL(env.CCB_API_URL);

  url.searchParams.set("srv", service);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const auth = Buffer.from(`${env.CCB_API_USERNAME}:${env.CCB_API_PASSWORD}`).toString(
    "base64"
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/xml,text/xml,*/*"
    }
  });

  const xml = await response.text();

  if (!response.ok) {
    throw new Error(`CCB HTTP ${response.status}: ${xml.slice(0, 500)}`);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    processEntities: false
  });

  return {
    url: sanitizeUrl(url.toString()),
    xml,
    parsed: parser.parse(xml)
  };
}

function sanitizeUrl(input: string) {
  const url = new URL(input);
  return `${url.origin}${url.pathname}?${url.searchParams.toString()}`;
}
