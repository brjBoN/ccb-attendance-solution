import { describe, expect, it } from "vitest";
import {
  PROFILE_UPDATE_TICKET_TTL_MS,
  signProfileUpdateTicket,
  verifyProfileUpdateTicket
} from "@/lib/checkin/profile-update-ticket";

const SECRET = "test-only-profile-update-secret";
const SESSION_ID = "4723036e-8ecc-46f1-9857-d42edaff1e13";
const TICKET_ID = "3b12f1df-5232-4804-897e-917bf397618a";

describe("profile update tickets", () => {
  it("round-trips a person and session for fifteen minutes", () => {
    const ticket = signProfileUpdateTicket(
      { sessionId: SESSION_ID, individualId: "514" },
      SECRET,
      1_000,
      TICKET_ID
    );

    expect(
      verifyProfileUpdateTicket(
        ticket,
        SECRET,
        1_000 + PROFILE_UPDATE_TICKET_TTL_MS - 1
      )
    ).toEqual({
      sessionId: SESSION_ID,
      individualId: "514",
      ticketId: TICKET_ID,
      expiresAt: 1_000 + PROFILE_UPDATE_TICKET_TTL_MS
    });
  });

  it("rejects expired, altered, and wrong-secret tickets", () => {
    const ticket = signProfileUpdateTicket(
      { sessionId: SESSION_ID, individualId: "514" },
      SECRET,
      1_000,
      TICKET_ID
    );

    expect(
      verifyProfileUpdateTicket(
        ticket,
        SECRET,
        1_000 + PROFILE_UPDATE_TICKET_TTL_MS
      )
    ).toBeNull();
    expect(
      verifyProfileUpdateTicket(`${ticket}changed`, SECRET, 1_001)
    ).toBeNull();
    expect(
      verifyProfileUpdateTicket(ticket, "different-secret", 1_001)
    ).toBeNull();
  });

  it("refuses invalid session or person identifiers", () => {
    expect(() =>
      signProfileUpdateTicket(
        { sessionId: "not-a-session", individualId: "514" },
        SECRET
      )
    ).toThrow();
    expect(() =>
      signProfileUpdateTicket(
        { sessionId: SESSION_ID, individualId: "not-a-person" },
        SECRET
      )
    ).toThrow();
  });
});
