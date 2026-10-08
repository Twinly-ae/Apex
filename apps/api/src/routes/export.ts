import type { FastifyInstance } from "fastify";
import { prisma } from "../db";

/**
 * Export the authenticated user's Apex data as a single JSON document.
 * Excludes login credentials, encrypted bank statement content and transaction
 * descriptions, and browser push subscriptions (including their auth keys).
 * Bank statements are exported as derived summaries and transaction amounts.
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
      noteFolders,
      notes,
      goals,
      courses,
      habits,
      workouts,
      trainingPlan,
      accounts,
      netWorthSnapshots,
      bills,
      healthMetrics,
      twinlyExpenses,
      twinlySales,
      businesses,
      bankStatements,
      aiConversations,
      aiMessages,
      aiMemories,
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
      prisma.task.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: { steps: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
      }),
      prisma.noteFolder.findMany({
        where: { userId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, emoji: true, sortOrder: true, createdAt: true },
      }),
      prisma.note.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          folderId: true,
          title: true,
          content: true,
          pinned: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.goal.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: { milestones: { orderBy: { order: "asc" } } },
      }),
      prisma.course.findMany({ where: { userId }, include: { items: true } }),
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
      prisma.business.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
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
      prisma.aiConversation.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, createdAt: true, updatedAt: true },
      }),
      prisma.aiMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.aiMemory.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true, content: true, source: true, createdAt: true },
      }),
      prisma.aiArtifact.findMany({ where: { userId }, orderBy: { updatedAt: "asc" } }),
      prisma.notificationLog.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    reply.header("Cache-Control", "private, no-store");
    reply.header(
      "Content-Disposition",
      `attachment; filename="apex-export-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    return {
      app: "Apex",
      version: 2,
      exportedAt: new Date().toISOString(),
      user,
      settings,
      meals,
      bodyweights,
      waterLogs,
      tasks,
      noteFolders,
      notes,
      goals,
      courses,
      habits,
      workouts,
      trainingPlan,
      accounts,
      netWorthSnapshots,
      bills,
      healthMetrics,
      twinlyExpenses,
      twinlySales,
      businesses,
      bankStatements,
      aiConversations,
      aiMessages,
      aiMemories,
      aiArtifacts,
      notifications,
    };
  });
}
