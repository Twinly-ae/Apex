import type {
  TwinlyExpense as DbExpense,
  TwinlySale as DbSale,
} from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  createTwinlySaleSchema,
  type SyncResult,
  type TwinlyExpense,
  type TwinlySale,
  type TwinlySalesSummary,
  type TwinlySummary,
} from "@apex/shared";
import { prisma } from "../db";
import { fetchExpenses, notionConfigured } from "../integrations/notion";
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

function toExpense(e: DbExpense): TwinlyExpense {
  return {
    id: e.id,
    title: e.title,
    category: e.category,
    amountAed: e.amountAed,
    date: e.date ? e.date.toISOString() : null,
  };
}

function monthOf(d: Date | null): string | null {
  return d ? dayString(d).slice(0, 7) : null;
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

export default async function twinlyRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/summary", async (request): Promise<TwinlySummary> => {
    const expenses = await prisma.twinlyExpense.findMany({
      where: { userId: request.userId },
      orderBy: { date: "desc" },
    });

    const thisMonth = dayString().slice(0, 7);
    const lastMonth = prevMonth(thisMonth);

    let monthToDateAed = 0;
    let lastMonthAed = 0;
    const byCategory = new Map<string, number>();

    for (const e of expenses) {
      const m = monthOf(e.date);
      if (m === thisMonth) {
        monthToDateAed += e.amountAed;
        const cat = e.category ?? "Uncategorized";
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + e.amountAed);
      } else if (m === lastMonth) {
        lastMonthAed += e.amountAed;
      }
    }

    let lastSyncedAt: Date | null = null;
    for (const e of expenses) {
      if (!lastSyncedAt || e.updatedAt > lastSyncedAt) lastSyncedAt = e.updatedAt;
    }

    return {
      connected: notionConfigured(),
      lastSyncedAt: lastSyncedAt ? lastSyncedAt.toISOString() : null,
      monthToDateAed: Math.round(monthToDateAed * 100) / 100,
      lastMonthAed: Math.round(lastMonthAed * 100) / 100,
      byCategory: [...byCategory.entries()]
        .map(([category, amountAed]) => ({
          category,
          amountAed: Math.round(amountAed * 100) / 100,
        }))
        .sort((a, b) => b.amountAed - a.amountAed),
      recent: expenses.slice(0, 10).map(toExpense),
    };
  });

  // ---- Twinly daily sales (manual entry) ----------------------------------
  app.get("/sales", async (request): Promise<TwinlySalesSummary> => {
    const sales = await prisma.twinlySale.findMany({
      where: { userId: request.userId },
      orderBy: { day: "desc" },
      take: 90,
    });
    const today = dayString();
    const month = today.slice(0, 7);
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
    return {
      today: todaySale ? toSale(todaySale) : null,
      monthRevenueAed: round2(monthRevenueAed),
      monthProfitAed: round2(monthProfitAed),
      monthOrders,
      recent: sales.slice(0, 14).map(toSale),
    };
  });

  app.post("/sales", async (request, reply) => {
    const body = parseOr400(createTwinlySaleSchema, request.body, reply);
    if (!body) return;
    const day = body.day ?? dayString();
    const sale = await prisma.twinlySale.upsert({
      where: { userId_day: { userId: request.userId, day } },
      create: {
        userId: request.userId,
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

  app.post("/sync", async (request): Promise<SyncResult> => {
    if (!notionConfigured()) {
      return {
        connected: false,
        imported: 0,
        total: 0,
        message: "Set NOTION_TOKEN to connect the expenses database.",
      };
    }
    let rows;
    try {
      rows = await fetchExpenses();
    } catch (err) {
      return {
        connected: true,
        imported: 0,
        total: 0,
        message: err instanceof Error ? err.message : "Notion sync failed",
      };
    }

    let imported = 0;
    for (const row of rows) {
      await prisma.twinlyExpense.upsert({
        where: { notionId: row.notionId },
        create: {
          userId: request.userId,
          notionId: row.notionId,
          title: row.title,
          category: row.category,
          amountAed: row.amountAed,
          date: row.date ? new Date(row.date) : null,
        },
        update: {
          title: row.title,
          category: row.category,
          amountAed: row.amountAed,
          date: row.date ? new Date(row.date) : null,
        },
      });
      imported++;
    }
    return { connected: true, imported, total: rows.length };
  });
}
