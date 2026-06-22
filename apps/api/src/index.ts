import { prisma } from "./db";
import { env } from "./env";
import { buildServer } from "./server";

async function main(): Promise<void> {
  const app = await buildServer();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down…`);
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  }
}

void main();
