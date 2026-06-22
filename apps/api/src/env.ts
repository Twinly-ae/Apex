import { config } from "dotenv";
import { z } from "zod";

// Load apps/api/.env when running locally. On Railway, vars come from the
// service environment and this is a no-op.
config();

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  APP_ORIGIN: z.string().url("APP_ORIGIN must be a full URL"),
  // Seed-only; not required to boot the server.
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_INITIAL_PASSWORD: z.string().min(1).optional(),

  // Phase 3 integrations — all optional; each feature is disabled until set.
  HEVY_API_KEY: z.string().optional(),
  NOTION_TOKEN: z.string().optional(),
  NOTION_EXPENSES_DB_ID: z
    .string()
    .optional()
    .default("5de30779-8408-455c-8c4d-525ed00bc4a1"),
  HEALTH_INGEST_TOKEN: z.string().optional(),

  // Phase 4 — AI coach + encryption for sensitive data at rest.
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional().default("claude-opus-4-8"),
  // 32-byte key (hex or base64) for AES-256-GCM. Required only for bank
  // statements; generate: openssl rand -hex 32
  ENCRYPTION_KEY: z.string().optional(),

  // Phase 5 — Web Push (VAPID). All optional; notifications stay off until set.
  // Generate a keypair: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  // Contact URI sent to push services, e.g. mailto:you@example.com
  VAPID_SUBJECT: z.string().optional().default("mailto:admin@my-apex.net"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ Invalid environment configuration:\n" +
      JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
