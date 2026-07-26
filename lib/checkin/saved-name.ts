const REUSABLE_GROUP_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STORAGE_KEY_PREFIX = "heritage-checkin:saved-name:v1:";
const MAX_NAME_LENGTH = 80;

export const SAVED_NAME_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type SavedCheckinName = {
  firstName: string;
  lastName: string;
  expiresAt: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function savedNameStorageKey(token: string) {
  const normalizedToken = token.trim().toLowerCase();
  if (!REUSABLE_GROUP_TOKEN_PATTERN.test(normalizedToken)) return null;
  return `${STORAGE_KEY_PREFIX}${normalizedToken}`;
}

export function serializeSavedCheckinName(
  value: Pick<SavedCheckinName, "firstName" | "lastName">,
  now = Date.now()
) {
  const firstName = normalizeName(value.firstName);
  const lastName = normalizeName(value.lastName);
  if (!firstName || !lastName) return null;

  return JSON.stringify({
    v: 1,
    firstName,
    lastName,
    expiresAt: now + SAVED_NAME_TTL_MS
  });
}

export function parseSavedCheckinName(
  raw: string | null,
  now = Date.now()
): SavedCheckinName | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    if (candidate.v !== 1) return null;

    const firstName =
      typeof candidate.firstName === "string"
        ? normalizeName(candidate.firstName)
        : null;
    const lastName =
      typeof candidate.lastName === "string"
        ? normalizeName(candidate.lastName)
        : null;
    const expiresAt =
      typeof candidate.expiresAt === "number" &&
      Number.isFinite(candidate.expiresAt)
        ? candidate.expiresAt
        : null;

    if (!firstName || !lastName || !expiresAt || expiresAt <= now) {
      return null;
    }

    return { firstName, lastName, expiresAt };
  } catch {
    return null;
  }
}

export function readSavedCheckinName(
  storage: StorageLike,
  token: string,
  now = Date.now()
) {
  const key = savedNameStorageKey(token);
  if (!key) return null;

  try {
    const raw = storage.getItem(key);
    const savedName = parseSavedCheckinName(raw, now);
    if (raw && !savedName) storage.removeItem(key);
    return savedName;
  } catch {
    return null;
  }
}

export function writeSavedCheckinName(
  storage: StorageLike,
  token: string,
  value: Pick<SavedCheckinName, "firstName" | "lastName">,
  now = Date.now()
) {
  const key = savedNameStorageKey(token);
  const serialized = serializeSavedCheckinName(value, now);
  if (!key || !serialized) return false;

  try {
    storage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

function normalizeName(value: string) {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized && normalized.length <= MAX_NAME_LENGTH
    ? normalized
    : null;
}
