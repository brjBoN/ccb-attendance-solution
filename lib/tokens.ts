import "server-only";

import crypto from "node:crypto";
import { signClassPresentationToken } from "@/lib/checkin/presentation-token";

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

export function buildClassPresentationUrl(
  baseUrl: string,
  publicSlug: string,
  secret: string
) {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const token = signClassPresentationToken(publicSlug, secret);
  return `${cleanBase}/present/g/${encodeURIComponent(token)}`;
}
