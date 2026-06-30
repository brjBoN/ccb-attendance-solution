import "server-only";

import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CCB_API_URL: z.string().url(),
  CCB_API_USERNAME: z.string().min(1),
  CCB_API_PASSWORD: z.string().min(1),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  PUBLIC_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  PUBLIC_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(20)
});

export function getPublicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });
}

export function getServerEnv() {
  return serverSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CCB_API_URL: process.env.CCB_API_URL,
    CCB_API_USERNAME: process.env.CCB_API_USERNAME,
    CCB_API_PASSWORD: process.env.CCB_API_PASSWORD,
    APP_BASE_URL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL || undefined,
    PUBLIC_RATE_LIMIT_WINDOW_SECONDS: process.env.PUBLIC_RATE_LIMIT_WINDOW_SECONDS ?? "60",
    PUBLIC_RATE_LIMIT_MAX_ATTEMPTS: process.env.PUBLIC_RATE_LIMIT_MAX_ATTEMPTS ?? "20"
  });
}
