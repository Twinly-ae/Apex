// Web Push (VAPID) — server side only. Notifications stay disabled until the
// VAPID_* env vars are set; every caller checks pushConfigured() first.
import webpush from "web-push";
import { prisma } from "../db";
import { env } from "../env";

let configured = false;

export function pushConfigured(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

/** Set VAPID details once; safe to call repeatedly. */
function ensureSetup(): boolean {
  if (configured) return true;
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY as string,
    env.VAPID_PRIVATE_KEY as string,
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a payload to all of a user's subscriptions. Dead subscriptions
 * (HTTP 404/410 from the push service) are pruned automatically.
 * Returns the number of successful deliveries.
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ensureSetup()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        delivered += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: s.id } })
            .catch(() => undefined);
        }
      }
    }),
  );
  return delivered;
}
