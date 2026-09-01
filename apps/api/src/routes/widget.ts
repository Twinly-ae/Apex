// Read-only, token-authenticated snapshot for home-screen widgets (Scriptable
// on iOS). Deliberately tiny and side-effect free: it can only read tasks, and
// the token is revoked by changing WIDGET_TOKEN on the API.
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db";
import { env } from "../env";
import { dayRange, dayString } from "../lib/time";

/** Resolve the single user from a widget token, or answer with an error. */
async function authorize(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ userId: string } | null> {
  if (!env.WIDGET_TOKEN) {
    reply.code(503).send({ error: "Widget is not configured (set WIDGET_TOKEN)" });
    return null;
  }
  const header = request.headers["x-widget-token"];
  const query = (request.query as Record<string, unknown> | undefined)?.token;
  const token = (Array.isArray(header) ? header[0] : header) ?? query;
  if (typeof token !== "string" || token !== env.WIDGET_TOKEN) {
    reply.code(401).send({ error: "Invalid widget token" });
    return null;
  }
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    reply.code(409).send({ error: "No user yet" });
    return null;
  }
  return { userId: user.id };
}

export default async function widgetRoutes(app: FastifyInstance): Promise<void> {
  app.get("/tasks", async (request, reply) => {
    const auth = await authorize(request, reply);
    if (!auth) return;

    const today = dayString();
    const { start, end } = dayRange();
    const [open, doneToday] = await Promise.all([
      prisma.task.findMany({
        where: { userId: auth.userId, done: false },
        include: { steps: { orderBy: { order: "asc" } } },
        orderBy: [{ priority: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
        take: 60,
      }),
      prisma.task.count({
        where: { userId: auth.userId, done: true, doneAt: { gte: start, lt: end } },
      }),
    ]);

    // Urgency first (overdue → due today → dated → undated), then priority.
    const rank = (due: string | null): number => {
      if (!due) return 3;
      if (due < today) return 0;
      if (due === today) return 1;
      return 2;
    };
    const rows = open
      .map((t) => {
        const due = t.dueDate ? dayString(t.dueDate) : null;
        return {
          id: t.id,
          title: t.title,
          priority: t.priority,
          due,
          // "overdue" | "today" | YYYY-MM-DD | null — ready to render as-is.
          dueLabel: due ? (due < today ? "overdue" : due === today ? "today" : due) : null,
          estMinutes: t.estMinutes,
          nextStep: t.steps.find((s) => !s.done)?.title ?? null,
          rank: rank(due),
        };
      })
      .sort((a, b) => a.rank - b.rank || a.priority - b.priority);

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        open: open.length,
        overdue: rows.filter((r) => r.rank === 0).length,
        dueToday: rows.filter((r) => r.rank === 1).length,
        doneToday,
      },
      tasks: rows.slice(0, 8).map(({ rank: _rank, ...t }) => t),
    };
  });
}
