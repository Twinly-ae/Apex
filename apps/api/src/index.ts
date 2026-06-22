import { prisma } from "./db";
import { env } from "./env";
import { aiConfigured } from "./lib/ai";
import { encryptionConfigured } from "./lib/crypto";
import { runNotificationChecks } from "./lib/notifications";
import { pushConfigured } from "./lib/push";
import { buildServer } from "./server";

const NOTIFY_INTERVAL_MS = 15 * 60 * 1000; // re-evaluate reminder rules every 15m

// Surface anything that would otherwise crash the process silently, so the
// reason shows up in the Railway logs instead of just a 502.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});

async function main(): Promise<void> {
  const app = await buildServer();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Boot diagnostics (no secrets): the CORS origin the browser MUST match, and
  // which integrations this process can actually see. A wrong APP_ORIGIN here is
  // the usual cause of "Couldn't reach the server" in the web app.
  app.log.info(
    {
      appOrigin: env.APP_ORIGIN,
      integrations: {
        ai: aiConfigured(),
        notion: Boolean(env.NOTION_TOKEN),
        hevy: Boolean(env.HEVY_API_KEY),
        healthIngest: Boolean(env.HEALTH_INGEST_TOKEN),
        encryption: encryptionConfigured(),
        push: pushConfigured(),
      },
    },
    "Apex API ready — CORS locked to APP_ORIGIN above",
  );

  // Phase 5: in-process reminder scheduler. Each rule is time-gated and deduped,
  // so polling is cheap and safe. Only runs when push is actually configured.
  let notifyTimer: NodeJS.Timeout | undefined;
  if (pushConfigured()) {
    const tick = () =>
      runNotificationChecks().catch((err) =>
        app.log.error({ err }, "notification check failed"),
      );
    notifyTimer = setInterval(tick, NOTIFY_INTERVAL_MS);
    notifyTimer.unref(); // don't keep the process alive just for the timer
    setTimeout(tick, 10_000); // first pass shortly after boot
    app.log.info("Push notifications enabled; reminder scheduler started.");
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down…`);
      if (notifyTimer) clearInterval(notifyTimer);
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  }
}

void main();
