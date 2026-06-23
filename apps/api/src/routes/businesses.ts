import type {
  Business as DbBusiness,
  TwinlySale as DbSale,
} from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  type Business,
  type BusinessSummary,
  createBusinessSchema,
  createTwinlySaleSchema,
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
  return { id: b.id, name: b.name, sortOrder: b.sortOrder };
}

/** Always return at least one business, creating a default the first time. */
async function ensureBusinesses(userId: string): Promise<DbBusiness[]> {
  const existing = await prisma.business.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (existing.length) return existing;
  const created = await prisma.business.create({
    data: { userId, name: "Twinly", sortOrder: 0 },
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
    const result = await prisma.business.updateMany({
      where: { id, userId: request.userId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
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
