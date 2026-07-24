import "server-only";

import crypto from "node:crypto";

export function generateCheckinToken() {
  // 32 random bytes -> 43 URL-safe base64url chars.
  return crypto.randomBytes(32).toString("base64url");
}

export function hashCheckinToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function buildCheckinUrl(baseUrl: string, token: string) {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  return `${cleanBase}/checkin/g/${encodeURIComponent(token)}`;
}

export function buildClassCheckinUrl(baseUrl: string, publicSlug: string) {
  return buildCheckinUrl(baseUrl, publicSlug);
}
