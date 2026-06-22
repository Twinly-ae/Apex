import type { FastifyInstance } from "fastify";
import {
  type PushConfig,
  notificationPrefsSchema,
  pushSubscriptionSchema,
  unsubscribeSchema,
} from "@apex/shared";
import { prisma } from "../db";
import { env } from "../env";
import { parseOr400 } from "../lib/http";
import { pushConfigured, sendToUser } from "../lib/push";
import { ensureSettings } from "./settings";

export default async function pushRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/config", async (request): Promise<PushConfig> => {
    const s = await ensureSettings(request.userId);
    return {
      configured: pushConfigured(),
      publicKey: pushConfigured() ? (env.VAPID_PUBLIC_KEY ?? null) : null,
      prefs: {
        notifyBills: s.notifyBills,
        notifyStreak: s.notifyStreak,
        notifyLogging: s.notifyLogging,
      },
    };
  });

  app.post("/subscribe", async (request, reply) => {
    const body = parseOr400(pushSubscriptionSchema, request.body, reply);
    if (!body) return;
    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      update: { userId: request.userId, p256dh: body.keys.p256dh, auth: body.keys.auth },
      create: {
        userId: request.userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    });
    return { ok: true };
  });

  app.post("/unsubscribe", async (request, reply) => {
    const body = parseOr400(unsubscribeSchema, request.body, reply);
    if (!body) return;
    await prisma.pushSubscription
      .deleteMany({ where: { userId: request.userId, endpoint: body.endpoint } })
      .catch(() => undefined);
    return { ok: true };
  });

  app.put("/prefs", async (request, reply) => {
    const body = parseOr400(notificationPrefsSchema, request.body, reply);
    if (!body) return;
    await ensureSettings(request.userId);
    const s = await prisma.settings.update({
      where: { userId: request.userId },
      data: {
        notifyBills: body.notifyBills,
        notifyStreak: body.notifyStreak,
        notifyLogging: body.notifyLogging,
      },
    });
    return {
      notifyBills: s.notifyBills,
      notifyStreak: s.notifyStreak,
      notifyLogging: s.notifyLogging,
    };
  });

  app.post("/test", async (request, reply) => {
    if (!pushConfigured()) {
      reply.code(503).send({ error: "Push is not configured (set VAPID_* keys)" });
      return;
    }
    const sent = await sendToUser(request.userId, {
      title: "Apex",
      body: "Notifications are working. You're all set. ✦",
      url: "/",
      tag: "test",
    });
    if (sent === 0) {
      reply
        .code(409)
        .send({ error: "No active subscription on this device yet — enable first." });
      return;
    }
    return { ok: true, sent };
  });
}
