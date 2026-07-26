import crypto from "node:crypto";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function signClassPresentationToken(
  publicCheckinSlug: string,
  secret: string
) {
  if (!UUID_PATTERN.test(publicCheckinSlug)) {
    throw new Error("Cannot sign an invalid group check-in slug.");
  }

  const signature = crypto
    .createHmac("sha256", secret)
    .update(publicCheckinSlug, "utf8")
    .digest("base64url");

  return `${publicCheckinSlug}.${signature}`;
}

export function verifyClassPresentationToken(
  token: string,
  secret: string
) {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex < 1) return null;

  const publicCheckinSlug = token.slice(0, separatorIndex);
  const providedSignature = token.slice(separatorIndex + 1);
  if (
    !UUID_PATTERN.test(publicCheckinSlug) ||
    !/^[A-Za-z0-9_-]{43}$/.test(providedSignature)
  ) {
    return null;
  }

  const expectedSignature = signClassPresentationToken(
    publicCheckinSlug,
    secret
  ).slice(separatorIndex + 1);
  const providedBytes = Buffer.from(providedSignature, "base64url");
  const expectedBytes = Buffer.from(expectedSignature, "base64url");

  if (
    providedBytes.length !== expectedBytes.length ||
    !crypto.timingSafeEqual(providedBytes, expectedBytes)
  ) {
    return null;
  }

  return publicCheckinSlug;
}
