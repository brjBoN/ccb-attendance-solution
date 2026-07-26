import crypto from "node:crypto";

const TICKET_VERSION = 1;
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TICKET_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INDIVIDUAL_ID_PATTERN = /^\d{1,20}$/;

export const PROFILE_UPDATE_TICKET_TTL_MS = 15 * 60 * 1000;

export type ProfileUpdateTicketPayload = {
  sessionId: string;
  individualId: string;
  ticketId: string;
  expiresAt: number;
};

export function signProfileUpdateTicket(
  input: Pick<ProfileUpdateTicketPayload, "sessionId" | "individualId">,
  secret: string,
  now = Date.now(),
  ticketId = crypto.randomUUID()
) {
  if (
    !secret ||
    !SESSION_ID_PATTERN.test(input.sessionId) ||
    !INDIVIDUAL_ID_PATTERN.test(input.individualId) ||
    !TICKET_ID_PATTERN.test(ticketId)
  ) {
    throw new Error("Cannot create an invalid profile-update ticket.");
  }

  const encodedPayload = Buffer.from(
    JSON.stringify({
      v: TICKET_VERSION,
      sid: input.sessionId,
      pid: input.individualId,
      jti: ticketId,
      exp: now + PROFILE_UPDATE_TICKET_TTL_MS
    })
  ).toString("base64url");

  return `${encodedPayload}.${signatureFor(encodedPayload, secret)}`;
}

export function verifyProfileUpdateTicket(
  ticket: string,
  secret: string,
  now = Date.now()
): ProfileUpdateTicketPayload | null {
  if (!ticket || !secret) return null;

  const parts = ticket.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = signatureFor(encodedPayload, secret);

  if (!safeEqual(providedSignature, expectedSignature)) return null;

  try {
    const value: unknown = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const payload = value as Record<string, unknown>;
    if (
      payload.v !== TICKET_VERSION ||
      typeof payload.sid !== "string" ||
      typeof payload.pid !== "string" ||
      typeof payload.jti !== "string" ||
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp) ||
      !SESSION_ID_PATTERN.test(payload.sid) ||
      !INDIVIDUAL_ID_PATTERN.test(payload.pid) ||
      !TICKET_ID_PATTERN.test(payload.jti) ||
      payload.exp <= now
    ) {
      return null;
    }

    return {
      sessionId: payload.sid,
      individualId: payload.pid,
      ticketId: payload.jti,
      expiresAt: payload.exp
    };
  } catch {
    return null;
  }
}

function signatureFor(payload: string, secret: string) {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}
