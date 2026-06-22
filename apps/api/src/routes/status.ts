import type { FastifyInstance } from "fastify";
import type {
  IntegrationCheck,
  IntegrationCheckResult,
  IntegrationStatus,
} from "@apex/shared";
import { env } from "../env";
import { aiConfigured, pingAi } from "../lib/ai";
import { encryptionConfigured } from "../lib/crypto";
import { pushConfigured } from "../lib/push";
import { hevyConfigured, pingHevy } from "../integrations/hevy";
import { notionConfigured, pingNotion } from "../integrations/notion";

/** Reject if the promise hasn't settled within `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms),
    ),
  ]);
}

async function check(
  name: IntegrationCheck["name"],
  configured: boolean,
  ping: () => Promise<void>,
): Promise<IntegrationCheck> {
  if (!configured) return { name, configured: false, ok: false, detail: "not set" };
  try {
    await withTimeout(ping(), 9000);
    return { name, configured: true, ok: true, detail: "working" };
  } catch (err) {
    const detail = (err instanceof Error ? err.message : String(err)).slice(0, 160);
    return { name, configured: true, ok: false, detail };
  }
}

/**
 * Diagnostics: which integrations the API process actually sees. Returns
 * booleans only — never the key values. Lets the user confirm, from inside the
 * app, that their env vars reached the *API* service (the usual gotcha is
 * setting them on the wrong Railway service or before a redeploy).
 */
export default async function statusRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (): Promise<IntegrationStatus> => {
    return {
      ai: aiConfigured(),
      encryption: encryptionConfigured(),
      hevy: Boolean(env.HEVY_API_KEY),
      notion: Boolean(env.NOTION_TOKEN),
      healthIngest: Boolean(env.HEALTH_INGEST_TOKEN),
      push: pushConfigured(),
      model: env.ANTHROPIC_MODEL,
    };
  });

  // Live check: actually call each outbound provider so a present-but-invalid
  // key (or a Notion DB that isn't shared) shows up as a real error.
  app.post("/check", async (): Promise<IntegrationCheckResult> => {
    const checks = await Promise.all([
      check("ai", aiConfigured(), pingAi),
      check("notion", notionConfigured(), pingNotion),
      check("hevy", hevyConfigured(), pingHevy),
    ]);
    return { checks };
  });
}
