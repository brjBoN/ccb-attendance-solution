const ALLOWED_IMAGE_HOST = "ccbchurch.s3.amazonaws.com";
const ALLOWED_IMAGE_PATH_PREFIX = "/30722/pics/group/";
const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export function validatedCcbGroupImageUrl(value: string | null) {
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== ALLOWED_IMAGE_HOST ||
    !url.pathname.startsWith(ALLOWED_IMAGE_PATH_PREFIX) ||
    url.username ||
    url.password
  ) {
    return null;
  }

  return url;
}

export function isAllowedCcbGroupImageContentType(value: string | null) {
  if (!value) return false;
  return ALLOWED_IMAGE_CONTENT_TYPES.has(value.split(";")[0].trim().toLowerCase());
}
