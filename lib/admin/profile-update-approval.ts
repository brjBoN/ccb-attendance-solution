import { z } from "zod";

export const profileUpdateApprovalSchema = z
  .object({
    identityVerified: z.literal(true)
  })
  .strict();
