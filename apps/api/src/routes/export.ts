import type { FastifyInstance } from "fastify";
import { prisma } from "../db";

/**
 * One-click export of everything the user has put into Apex, as a single JSON
 * document. Deliberately excludes secrets and encrypted-at-rest blobs: no
 * password hash, no raw statement text, no encrypted transaction descriptions —
 * bank statements are exported as their derived (non-sensitive) summaries.
 */
export default async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request, reply) => {
    const userId = request.userId;

    const [
      user,
      settings,
      meals,
      bodyweights,
      waterLogs,
      tasks,
      goals,
      habits,
      workouts,
      trainingPlan,
      accounts,
      netWorthSnapshots,
      bills,
      healthMetrics,
      twinlyExpenses,
      twinlySales,
      bankStatements,
      aiMessages,
      aiArtifacts,
      notifications,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, createdAt: true },
      }),
      prisma.settings.findUnique({ where: { userId } }),
      prisma.meal.findMany({ where: { userId }, orderBy: { eatenAt: "asc" } }),
      prisma.bodyweightEntry.findMany({
        where: { userId },
        orderBy: { measuredAt: "asc" },
      }),
      prisma.waterLog.findMany({ where: { userId }, orderBy: { loggedAt: "asc" } }),
      prisma.task.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.goal.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: { milestones: { orderBy: { order: "asc" } } },
      }),
      prisma.habit.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: { logs: { orderBy: { day: "asc" } } },
      }),
      prisma.workout.findMany({
        where: { userId },
        orderBy: { performedAt: "asc" },
        include: { sets: { orderBy: { order: "asc" } } },
      }),
      prisma.trainingPlan.findUnique({ where: { userId } }),
      prisma.account.findMany({
        where: { userId },
        orderBy: { sortOrder: "asc" },
        include: { positions: true },
      }),
      prisma.netWorthSnapshot.findMany({
        where: { userId },
        orderBy: { day: "asc" },
      }),
      prisma.bill.findMany({ where: { userId }, orderBy: { nextDueDate: "asc" } }),
      prisma.healthMetric.findMany({
        where: { userId },
        orderBy: { startAt: "asc" },
      }),
      prisma.twinlyExpense.findMany({ where: { userId }, orderBy: { date: "asc" } }),
      prisma.twinlySale.findMany({ where: { userId }, orderBy: { day: "asc" } }),
      prisma.bankStatement.findMany({
        where: { userId },
        orderBy: { month: "asc" },
        select: {
          id: true,
          month: true,
          filename: true,
          summary: true,
          createdAt: true,
          transactions: {
            select: { day: true, amountAed: true, category: true, kind: true },
          },
        },
      }),
      prisma.aiMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.aiArtifact.findMany({ where: { userId }, orderBy: { updatedAt: "asc" } }),
      prisma.notificationLog.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    reply.header(
      "Content-Disposition",
      `attachment; filename="apex-export-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    return {
      app: "Apex",
      version: 1,
      exportedAt: new Date().toISOString(),
      user,
      settings,
      meals,
      bodyweights,
      waterLogs,
      tasks,
      goals,
      habits,
      workouts,
      trainingPlan,
      accounts,
      netWorthSnapshots,
      bills,
      healthMetrics,
      twinlyExpenses,
      twinlySales,
      bankStatements,
      aiMessages,
      aiArtifacts,
      notifications,
    };
  });
}
