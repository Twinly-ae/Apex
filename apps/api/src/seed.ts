import { DEFAULT_SETTINGS } from "@apex/shared";
import { hashPassword } from "./auth";
import { prisma } from "./db";
import { env } from "./env";

/**
 * Creates the single Apex user from ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD.
 * Idempotent: if the user already exists it leaves the account untouched.
 * Change the password in-app after first login.
 */
async function main(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_INITIAL_PASSWORD) {
    console.error(
      "Set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD in apps/api/.env before seeding.",
    );
    process.exit(1);
  }

  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists — nothing to do.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(env.ADMIN_INITIAL_PASSWORD),
      settings: { create: { ...DEFAULT_SETTINGS } },
    },
  });
  console.log(`✅ Created Apex user ${email}. Change the password after login.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
