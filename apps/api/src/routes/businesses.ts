import type {
  Business as DbBusiness,
  TwinlySale as DbSale,
} from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  type Business,
  type BusinessPnl,
  type BusinessSummary,
  createBusinessSchema,
  createTwinlySaleSchema,
  type PnlMonth,
  type TwinlySale,
  updateBusinessSchema,
} from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";
import { dayString } from "../lib/time";

const round2 = (n: number) => Math.round(n * 100) / 100;

function toSale(s: DbSale): TwinlySale {
  return {
    id: s.id,
    day: s.day,
    revenueAed: s.revenueAed,
    orders: s.orders,
    costAed: s.costAed,
    profitAed: round2(s.revenueAed - s.costAed),
    note: s.note,
  };
}

function toBusiness(b: DbBusiness): Business {
  return {
    id: b.id,
    name: b.name,
    sortOrder: b.sortOrder,
    notionExpenseSource: b.notionExpenseSource === "twinly",
  };
}

/** Always return at least one business, creating a default the first time. */
async function ensureBusinesses(userId: string): Promise<DbBusiness[]> {
  const existing = await prisma.business.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (existing.length) return existing;
  const created = await prisma.business.create({
    data: { userId, name: "Twinly", sortOrder: 0, notionExpenseSource: "twinly" },
  });
  return [created];
}

export default async function businessRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request): Promise<BusinessSummary[]> => {
    const businesses = await ensureBusinesses(request.userId);
    const month = dayString().slice(0, 7);
    const today = dayString();
    const out: BusinessSummary[] = [];
    for (const b of businesses) {
      const sales = await prisma.twinlySale.findMany({
        where: { businessId: b.id },
        orderBy: { day: "desc" },
        take: 90,
      });
      let monthRevenueAed = 0;
      let monthProfitAed = 0;
      let monthOrders = 0;
      for (const s of sales) {
        if (s.day.slice(0, 7) === month) {
          monthRevenueAed += s.revenueAed;
          monthProfitAed += s.revenueAed - s.costAed;
          monthOrders += s.orders;
        }
      }
      const todaySale = sales.find((s) => s.day === today);
      out.push({
        ...toBusiness(b),
        monthRevenueAed: round2(monthRevenueAed),
        monthProfitAed: round2(monthProfitAed),
        monthOrders,
        today: todaySale ? toSale(todaySale) : null,
        recent: sales.slice(0, 14).map(toSale),
      });
    }
    return out;
  });

  // GET /api/businesses/pnl?months=6 — monthly revenue / costs / expenses /
  // profit per business. Unlinked Notion expenses stay visible in their own row.
  app.get("/pnl", async (request): Promise<BusinessPnl[]> => {
    const raw = Number(
      (request.query as Record<string, unknown> | undefined)?.months,
    );
    const monthsBack = Math.min(Math.max(Number.isFinite(raw) ? Math.floor(raw) : 6, 1), 24);

    // The month keys, oldest → newest, ending this month.
    const now = new Date(`${dayString().slice(0, 7)}-01T00:00:00Z`);
    const keys: string[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      keys.push(d.toISOString().slice(0, 7));
    }
    const since = `${keys[0]}-01`;

    const businesses = await ensureBusinesses(request.userId);
    const linkedBusiness = businesses.find((b) => b.notionExpenseSource === "twinly");
    const [sales, expenses] = await Promise.all([
      prisma.twinlySale.findMany({
        where: { userId: request.userId, day: { gte: since } },
        select: { businessId: true, day: true, revenueAed: true, costAed: true },
      }),
      prisma.twinlyExpense.findMany({
        where: { userId: request.userId, date: { gte: new Date(new Date(`${since}T00:00:00Z`).getTime() - 4 * 60 * 60_000) } },
        select: { date: true, amountAed: true },
      }),
    ]);

    const expByMonth = new Map<string, number>();
    for (const e of expenses) {
      if (!e.date) continue;
      const m = dayString(e.date).slice(0, 7);
      expByMonth.set(m, (expByMonth.get(m) ?? 0) + e.amountAed);
    }

    const result = businesses.map((b) => {
      const months: PnlMonth[] = keys.map((month) => {
        let revenueAed = 0;
        let costAed = 0;
        for (const s of sales) {
          if (s.businessId === b.id && s.day.slice(0, 7) === month) {
            revenueAed += s.revenueAed;
            costAed += s.costAed;
          }
        }
        const expensesAed = linkedBusiness?.id === b.id ? (expByMonth.get(month) ?? 0) : 0;
        return {
          month,
          revenueAed: round2(revenueAed),
          costAed: round2(costAed),
          expensesAed: round2(expensesAed),
          profitAed: round2(revenueAed - costAed - expensesAed),
        };
      });
      return { id: b.id, name: b.name, months };
    });
    if (!linkedBusiness && [...expByMonth.values()].some((amount) => amount !== 0)) {
      result.push({
        id: "unassigned-notion-expenses",
        name: "Notion expenses (choose a business below)",
        months: keys.map((month) => ({
          month,
          revenueAed: 0,
          costAed: 0,
          expensesAed: round2(expByMonth.get(month) ?? 0),
          profitAed: round2(-(expByMonth.get(month) ?? 0)),
        })),
      });
    }
    return result;
  });

  app.post("/", async (request, reply) => {
    const body = parseOr400(createBusinessSchema, request.body, reply);
    if (!body) return;
    const count = await prisma.business.count({
      where: { userId: request.userId },
    });
    const b = await prisma.business.create({
      data: { userId: request.userId, name: body.name, sortOrder: count },
    });
    reply.code(201);
    return toBusiness(b);
  });

  app.patch("/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = parseOr400(updateBusinessSchema, request.body, reply);
    if (!body) return;
    // Keep the one Notion ledger attached to exactly one business at a time.
    // The database unique constraint also protects against concurrent assignments.
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.findFirst({
        where: { id, userId: request.userId },
        select: { id: true },
      });
      if (!business) return { count: 0 };
      if (body.notionExpenseSource === true) {
        await tx.business.updateMany({
          where: { userId: request.userId, notionExpenseSource: "twinly" },
          data: { notionExpenseSource: null },
        });
      }
      return tx.business.updateMany({
        where: { id, userId: request.userId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          ...(body.notionExpenseSource !== undefined
            ? { notionExpenseSource: body.notionExpenseSource ? "twinly" : null }
            : {}),
        },
      });
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return { ok: true };
  });

  app.delete("/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const result = await prisma.business.deleteMany({
      where: { id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return { ok: true };
  });

  // Upsert a day's sales for a business.
  app.post("/:id/sales", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = parseOr400(createTwinlySaleSchema, request.body, reply);
    if (!body) return;
    const business = await prisma.business.findFirst({
      where: { id, userId: request.userId },
    });
    if (!business) {
      reply.code(404).send({ error: "Business not found" });
      return;
    }
    const day = body.day ?? dayString();
    const sale = await prisma.twinlySale.upsert({
      where: { businessId_day: { businessId: id, day } },
      create: {
        userId: request.userId,
        businessId: id,
        day,
        revenueAed: body.revenueAed,
        orders: body.orders,
        costAed: body.costAed,
        note: body.note ?? null,
      },
      update: {
        revenueAed: body.revenueAed,
        orders: body.orders,
        costAed: body.costAed,
        note: body.note ?? null,
      },
    });
    reply.code(201);
    return toSale(sale);
  });
}
