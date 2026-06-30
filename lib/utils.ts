import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function maskEmail(email?: string | null) {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

export function maskPhone(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `•••-•••-${digits.slice(-4)}`;
}
