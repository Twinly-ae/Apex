import { hash, verify } from "@node-rs/argon2";
import type { FastifyInstance } from "fastify";
import {
  changePasswordSchema,
  loginSchema,
  type PublicUser,
} from "@apex/shared";
import { prisma } from "./db";
import { parseOr400 } from "./lib/http";

/** Strip secrets before any user object leaves the server. */
export function toPublicUser(user: {
  id: string;
  email: string;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

/**
 * Registers the `authenticate` preHandler and the /api/auth routes.
 * Decorators land on the root instance so every prefixed route can reuse them.
 */
export async function registerAuth(app: FastifyInstance): Promise<void> {
  // A real argon2 hash we verify against when the email is unknown, so login
  // takes the same time whether or not the account exists (no user enumeration).
  const dummyHash = await hashPassword("apex-timing-equalizer");

  app.decorateRequest("userId", "");

  app.decorate("authenticate", async function (request, reply) {
    const userId = request.session.get("userId");
    if (!userId) {
      reply.code(401).send({ error: "Unauthorized" });
      return reply;
    }
    request.userId = userId;
  });

  app.register(
    async (auth) => {
      // Stricter limit on the login route to slow credential stuffing.
      auth.post(
        "/login",
        { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
        async (request, reply) => {
          const body = parseOr400(loginSchema, request.body, reply);
          if (!body) return;

          const user = await prisma.user.findUnique({
            where: { email: body.email.toLowerCase() },
          });

          let ok = false;
          if (user) {
            ok = await verify(user.passwordHash, body.password).catch(
              () => false,
            );
          } else {
            // Burn the same time as a real verify, then fail.
            await verify(dummyHash, body.password).catch(() => undefined);
          }

          if (!user || !ok) {
            reply.code(401).send({ error: "Invalid email or password" });
            return;
          }

          request.session.set("userId", user.id);
          return toPublicUser(user);
        },
      );

      auth.post("/logout", async (request, reply) => {
        request.session.delete();
        return reply.send({ ok: true });
      });

      auth.get(
        "/me",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
          const user = await prisma.user.findUnique({
            where: { id: request.userId },
          });
          if (!user) {
            request.session.delete();
            reply.code(401).send({ error: "Unauthorized" });
            return;
          }
          return toPublicUser(user);
        },
      );

      auth.post(
        "/password",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
          const body = parseOr400(changePasswordSchema, request.body, reply);
          if (!body) return;

          const user = await prisma.user.findUnique({
            where: { id: request.userId },
          });
          if (!user) {
            reply.code(401).send({ error: "Unauthorized" });
            return;
          }
          const ok = await verify(
            user.passwordHash,
            body.currentPassword,
          ).catch(() => false);
          if (!ok) {
            reply.code(400).send({ error: "Current password is incorrect" });
            return;
          }
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: await hashPassword(body.newPassword) },
          });
          return { ok: true };
        },
      );
    },
    { prefix: "/api/auth" },
  );
}
