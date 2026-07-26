import { z } from "zod";

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .optional()
  .or(z.literal(""));

const optionalPhone = z
  .string()
  .trim()
  .max(40)
  .optional()
  .or(z.literal(""));

export const profileUpdateRequestSchema = z
  .object({
    ticket: z.string().trim().min(1).max(1500),
    email: optionalEmail,
    mobilePhone: optionalPhone,
    homePhone: optionalPhone
  })
  .strict()
  .superRefine((value, context) => {
    const email = value.email?.trim() ?? "";
    const mobilePhone = value.mobilePhone?.trim() ?? "";
    const homePhone = value.homePhone?.trim() ?? "";

    if (!email && !mobilePhone && !homePhone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a new email, mobile phone, or home phone."
      });
    }

    if (email && !z.string().email().safeParse(email).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Enter a valid email address."
      });
    }

    if (
      mobilePhone &&
      (mobilePhone.replace(/\D/g, "").length < 7 ||
        !/^[\d\s()+.-]+$/.test(mobilePhone))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mobilePhone"],
        message: "Enter a valid mobile phone number."
      });
    }

    if (
      homePhone &&
      (homePhone.replace(/\D/g, "").length < 7 ||
        !/^[\d\s()+.-]+$/.test(homePhone))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["homePhone"],
        message: "Enter a valid home phone number."
      });
    }
  });

export function normalizeProfileUpdateRequest(
  value: z.infer<typeof profileUpdateRequestSchema>
) {
  return {
    ticket: value.ticket.trim(),
    email: value.email?.trim() || null,
    mobilePhone: value.mobilePhone?.trim() || null,
    homePhone: value.homePhone?.trim() || null
  };
}
