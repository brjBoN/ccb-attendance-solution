import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env.local" });
config();

const schema = z.object({
  CCB_API_URL: z.string().url(),
  CCB_API_USERNAME: z.string().min(1),
  CCB_API_PASSWORD: z.string().min(1)
});

export function getScriptEnv() {
  return schema.parse({
    CCB_API_URL: process.env.CCB_API_URL,
    CCB_API_USERNAME: process.env.CCB_API_USERNAME,
    CCB_API_PASSWORD: process.env.CCB_API_PASSWORD
  });
}
