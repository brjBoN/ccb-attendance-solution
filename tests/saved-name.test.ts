import { describe, expect, it } from "vitest";
import {
  parseSavedCheckinName,
  readSavedCheckinName,
  removeSavedCheckinName,
  SAVED_NAME_TTL_MS,
  savedNameStorageKey,
  serializeSavedCheckinName,
  writeSavedCheckinName
} from "@/lib/checkin/saved-name";

const GROUP_A = "4723036e-8ecc-46f1-9857-d42edaff1e13";
const GROUP_B = "5723036e-8ecc-46f1-9857-d42edaff1e13";

describe("saved group check-in name", () => {
  it("creates a distinct key for each reusable group link", () => {
    expect(savedNameStorageKey(GROUP_A)).not.toBe(
      savedNameStorageKey(GROUP_B)
    );
    expect(savedNameStorageKey("legacy-secret-token")).toBeNull();
  });

  it("round-trips only a normalized first and last name", () => {
    const serialized = serializeSavedCheckinName(
      {
        firstName: "  Jordan\u0000  ",
        lastName: "  Matthews  "
      },
      1_000
    );

    expect(serialized).not.toBeNull();
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("phone");
    expect(serialized).not.toContain("ccb");
    expect(
      parseSavedCheckinName(serialized, 1_000 + SAVED_NAME_TTL_MS - 1)
    ).toEqual({
      firstName: "Jordan",
      lastName: "Matthews",
      expiresAt: 1_000 + SAVED_NAME_TTL_MS
    });
  });

  it("rejects expired, malformed, wrong-version, and oversized records", () => {
    expect(parseSavedCheckinName("{", 1_000)).toBeNull();
    expect(
      parseSavedCheckinName(
        JSON.stringify({
          v: 2,
          firstName: "Jordan",
          lastName: "Matthews",
          expiresAt: 2_000
        }),
        1_000
      )
    ).toBeNull();
    expect(
      parseSavedCheckinName(
        JSON.stringify({
          v: 1,
          firstName: "Jordan",
          lastName: "Matthews",
          expiresAt: 1_000
        }),
        1_000
      )
    ).toBeNull();
    expect(
      serializeSavedCheckinName({
        firstName: "x".repeat(81),
        lastName: "Matthews"
      })
    ).toBeNull();
  });

  it("keeps groups isolated and removes only the requested group", () => {
    const storage = memoryStorage();

    expect(
      writeSavedCheckinName(
        storage,
        GROUP_A,
        { firstName: "Jordan", lastName: "Matthews" },
        1_000
      )
    ).toBe(true);
    expect(
      writeSavedCheckinName(
        storage,
        GROUP_B,
        { firstName: "Taylor", lastName: "Morgan" },
        1_000
      )
    ).toBe(true);

    expect(readSavedCheckinName(storage, GROUP_A, 2_000)?.firstName).toBe(
      "Jordan"
    );
    expect(removeSavedCheckinName(storage, GROUP_A)).toBe(true);
    expect(readSavedCheckinName(storage, GROUP_A, 2_000)).toBeNull();
    expect(readSavedCheckinName(storage, GROUP_B, 2_000)?.firstName).toBe(
      "Taylor"
    );
  });

  it("fails safely when browser storage is unavailable", () => {
    const deniedStorage = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
      removeItem() {
        throw new Error("denied");
      }
    };

    expect(readSavedCheckinName(deniedStorage, GROUP_A)).toBeNull();
    expect(
      writeSavedCheckinName(deniedStorage, GROUP_A, {
        firstName: "Jordan",
        lastName: "Matthews"
      })
    ).toBe(false);
    expect(removeSavedCheckinName(deniedStorage, GROUP_A)).toBe(false);
  });
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    }
  };
}
