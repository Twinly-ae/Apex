// Phase 5 notification rules. A lightweight in-process scheduler (see index.ts)
// calls runNotificationChecks() periodically; each rule is time-gated and
// deduped via NotificationLog so the user gets at most one ping per event.
import { prisma } from "../db";
import { sendToUser } from "./push";
import { dayRange, dayString, localHour, localWeekdayMon0 } from "./time";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Create the dedupe log (unique on userId+dedupeKey) and, only if it was newly
 * created, push the notification. Returns true when a notification was sent.
 */
async function notifyOnce(
  userId: string,
  kind: string,
  dedupeKey: string,
  title: string,
  body: string,
  url?: string,
): Promise<boolean> {
  try {
    await prisma.notificationLog.create({
      data: { userId, kind, dedupeKey, title, body, url },
    });
  } catch {
    // Unique-constraint violation → already sent for this event. Skip.
    return false;
  }
  await sendToUser(userId, { title, body, url, tag: kind });
  return true;
}

async function checkBills(userId: string): Promise<void> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 3 * DAY_MS);
  const floor = new Date(now.getTime() - 1 * DAY_MS);
  const bills = await prisma.bill.findMany({
    where: { userId, nextDueDate: { gte: floor, lte: horizon } },
  });
  for (const b of bills) {
    const days = Math.round((b.nextDueDate.getTime() - now.getTime()) / DAY_MS);
    const dueDay = dayString(b.nextDueDate);
    const when =
      days <= 0 ? "is due today" : days === 1 ? "is due tomorrow" : `is due in ${days} days`;
    await notifyOnce(
      userId,
      "bill",
      `bill:${b.id}:${dueDay}`,
      "Bill due soon",
      `${b.name} (AED ${Math.round(b.amountAed)}) ${when}.`,
      "/money",
    );
  }
}

async function checkStreak(userId: string): Promise<void> {
  // Evening nudge only.
  if (localHour() < 18) return;
  const plan = await prisma.trainingPlan.findUnique({ where: { userId } });
  const label = plan?.days?.[localWeekdayMon0()]?.trim();
  if (!label || /^rest$/i.test(label)) return; // rest day — nothing to nudge

  const { start, end } = dayRange();
  const done = await prisma.workout.count({
    where: { userId, performedAt: { gte: start, lt: end } },
  });
  if (done > 0) return;

  await notifyOnce(
    userId,
    "streak",
    `streak:${dayString()}`,
    "Don't break the streak",
    `${label} is on today's plan and isn't logged yet. A quick session keeps your streak alive.`,
    "/",
  );
}

async function checkLogging(userId: string): Promise<void> {
  // Late-evening nudge if nothing was logged today.
  if (localHour() < 20) return;
  const { start, end } = dayRange();
  const meals = await prisma.meal.count({
    where: { userId, eatenAt: { gte: start, lt: end } },
  });
  if (meals > 0) return;

  await notifyOnce(
    userId,
    "logging",
    `logging:${dayString()}`,
    "Log today before bed",
    "You haven't logged any meals today — a few taps keeps your data honest.",
    "/",
  );
}

/** Evaluate every rule for every user. Safe to call frequently (rules dedupe). */
export async function runNotificationChecks(): Promise<void> {
  const users = await prisma.user.findMany({
    select: { id: true, settings: true },
  });
  for (const u of users) {
    const s = u.settings;
    try {
      if (s?.notifyBills ?? true) await checkBills(u.id);
      if (s?.notifyStreak ?? true) await checkStreak(u.id);
      if (s?.notifyLogging ?? true) await checkLogging(u.id);
    } catch (err) {
      // Never let one user's failure stop the loop.
      console.error("[notifications]", err);
    }
  }
}
