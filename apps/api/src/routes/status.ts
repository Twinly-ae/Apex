import type { FastifyInstance } from "fastify";
import type { IntegrationStatus } from "@apex/shared";
import { env } from "../env";
import { aiConfigured } from "../lib/ai";
import { encryptionConfigured } from "../lib/crypto";
import { pushConfigured } from "../lib/push";

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
}
