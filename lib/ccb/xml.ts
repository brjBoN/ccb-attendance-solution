export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

export function asArray<T = unknown>(value: unknown): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

export function textValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    return text.length ? text : null;
  }

  const record = asRecord(value);
  if (!record) return null;

  const possibleTextKeys = ["#text", "value", "text", "$text"];
  for (const key of possibleTextKeys) {
    const nested = record[key];
    if (typeof nested === "string" || typeof nested === "number" || typeof nested === "boolean") {
      const text = String(nested).trim();
      if (text.length) return text;
    }
  }

  return null;
}

export function attrValue(value: unknown, name: string): string | null {
  const record = asRecord(value);
  if (!record) return null;

  const keys = [`@_${name}`, `@${name}`, name];
  for (const key of keys) {
    const text = textValue(record[key]);
    if (text) return text;
  }

  return null;
}

export function firstText(record: UnknownRecord | null, keys: string[]): string | null {
  if (!record) return null;

  for (const key of keys) {
    const value = textValue(record[key]);
    if (value) return value;
  }

  return null;
}

export function firstRecord(record: UnknownRecord | null, keys: string[]): UnknownRecord | null {
  if (!record) return null;

  for (const key of keys) {
    const value = asRecord(record[key]);
    if (value) return value;
  }

  return null;
}

export function firstArray(record: UnknownRecord | null, keys: string[]): unknown[] {
  if (!record) return [];

  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined) return asArray(value);
  }

  return [];
}

export function ccbResponse(parsed: unknown): UnknownRecord | null {
  const root = asRecord(parsed);
  if (!root) return null;

  const ccb = asRecord(root.ccb_api) ?? root;
  return asRecord(ccb.response) ?? ccb;
}

export function safeJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export function sanitizeXmlForFixture(xml: string) {
  return xml
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "person@example.com")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "555-0100")
    .replace(/<password>.*?<\/password>/gi, "<password>[REDACTED]</password>");
}
