import type { FastifyInstance } from "fastify";
import {
  importStatementSchema,
  type StatementDetail,
  type StatementSummary,
} from "@apex/shared";
import { prisma } from "../db";
import type { AiMessageParam } from "../lib/ai";
import { aiConfigured, pdfMessage, runJSON } from "../lib/ai";
import { encrypt, encryptionConfigured } from "../lib/crypto";
import { parseOr400 } from "../lib/http";

interface ParsedTxn {
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
  category: string;
}
interface ParseResult {
  transactions: ParsedTxn[];
  tips?: string[];
}

const EXTRACT_SYS =
  "You are a UAE bank-statement parser. Extract EVERY transaction and categorize each. " +
  'Respond ONLY with JSON: {"transactions":[{"date":"YYYY-MM-DD","description":string,' +
  '"amount":<positive number, AED>,"type":"debit"|"credit","category":<one of: ' +
  "Groceries, Dining, Transport, Shopping, Bills, Subscriptions, Health, Entertainment, " +
  'Education, Transfers, Cash, Income, Other>}],"tips":[string]}. ' +
  "Use debit for money out, credit for money in; amounts always positive. " +
  "Give exactly 3 concise, personalized saving tips.";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildSummary(
  txns: ParsedTxn[],
  tips: string[],
  vsLastMonthAed: number | null,
): StatementSummary {
  const debits = txns.filter((t) => t.type === "debit");
  const credits = txns.filter((t) => t.type === "credit");
  const totalSpentAed = round2(debits.reduce((s, t) => s + t.amount, 0));
  const totalIncomeAed = round2(credits.reduce((s, t) => s + t.amount, 0));

  const cat = new Map<string, number>();
  for (const t of debits) cat.set(t.category, (cat.get(t.category) ?? 0) + t.amount);

  const biggest = [...debits]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6)
    .map((t) => ({
      description: t.description,
      amountAed: round2(t.amount),
      category: t.category,
    }));

  const subscriptions = debits
    .filter((t) => t.category === "Subscriptions")
    .map((t) => ({ description: t.description, amountAed: round2(t.amount) }));

  return {
    byCategory: [...cat.entries()]
      .map(([category, amountAed]) => ({ category, amountAed: round2(amountAed) }))
      .sort((a, b) => b.amountAed - a.amountAed),
    totalSpentAed,
    totalIncomeAed,
    savingsRate:
      totalIncomeAed > 0
        ? round2((totalIncomeAed - totalSpentAed) / totalIncomeAed)
        : null,
    biggest,
    subscriptions,
    tips: tips.slice(0, 5),
    vsLastMonthAed,
  };
}

function toListItem(s: {
  id: string;
  month: string;
  filename: string;
  createdAt: Date;
  summary: unknown;
  _count?: { transactions: number };
}) {
  const summary = (s.summary ?? {}) as unknown as StatementSummary;
  return {
    id: s.id,
    month: s.month,
    filename: s.filename,
    createdAt: s.createdAt.toISOString(),
    totalSpentAed: summary.totalSpentAed ?? 0,
    transactionCount: s._count?.transactions ?? 0,
  };
}

export default async function statementRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const rows = await prisma.bankStatement.findMany({
      where: { userId: request.userId },
      orderBy: { month: "desc" },
      include: { _count: { select: { transactions: true } } },
    });
    return rows.map(toListItem);
  });

  app.get("/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const s = await prisma.bankStatement.findFirst({
      where: { id, userId: request.userId },
      include: { _count: { select: { transactions: true } } },
    });
    if (!s) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    const detail: StatementDetail = {
      ...toListItem(s),
      summary: (s.summary ?? {}) as unknown as StatementSummary,
    };
    return detail;
  });

  app.delete("/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const result = await prisma.bankStatement.deleteMany({
      where: { id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return { ok: true };
  });

  // Import: parse + categorize with Claude, store encrypted, return the summary.
  app.post(
    "/",
    { bodyLimit: 12 * 1024 * 1024 },
    async (request, reply) => {
      if (!aiConfigured()) {
        reply.code(503).send({ error: "AI is not configured (set ANTHROPIC_API_KEY)" });
        return;
      }
      if (!encryptionConfigured()) {
        reply
          .code(503)
          .send({ error: "Encryption is not configured (set ENCRYPTION_KEY)" });
        return;
      }
      const body = parseOr400(importStatementSchema, request.body, reply);
      if (!body) return;

      let rawText: string | null = null;
      let message: AiMessageParam;
      if (body.kind === "pdf") {
        message = pdfMessage("Parse this bank statement.", body.dataBase64);
      } else {
        rawText = Buffer.from(body.dataBase64, "base64").toString("utf8");
        message = {
          role: "user",
          content: `Parse this CSV bank statement:\n\n${rawText.slice(0, 200000)}`,
        };
      }

      let parsed: ParseResult;
      try {
        parsed = await runJSON<ParseResult>({
          system: EXTRACT_SYS,
          messages: [message],
          maxTokens: 4000,
        });
      } catch (err) {
        reply.code(502).send({
          error: err instanceof Error ? err.message : "Statement parse failed",
        });
        return;
      }
      const txns = (parsed.transactions ?? []).filter(
        (t) => t && typeof t.amount === "number" && t.amount > 0,
      );

      // Compare spend vs the previous stored month.
      const prev = await prisma.bankStatement.findFirst({
        where: { userId: request.userId, month: { lt: body.month } },
        orderBy: { month: "desc" },
      });
      const prevSpent = prev
        ? ((prev.summary ?? {}) as unknown as StatementSummary).totalSpentAed ?? null
        : null;
      const summary = buildSummary(txns, parsed.tips ?? [], null);
      summary.vsLastMonthAed =
        prevSpent != null ? round2(summary.totalSpentAed - prevSpent) : null;

      const statement = await prisma.bankStatement.create({
        data: {
          userId: request.userId,
          month: body.month,
          filename: body.filename,
          encryptedRaw: rawText ? encrypt(rawText) : null,
          summary: summary as object,
          transactions: {
            create: txns.map((t) => ({
              userId: request.userId,
              day: t.date,
              descriptionEnc: encrypt(t.description ?? ""),
              amountAed: t.amount,
              category: t.category || "Other",
              kind: t.type === "credit" ? "credit" : "debit",
            })),
          },
        },
        include: { _count: { select: { transactions: true } } },
      });

      // Per-transaction descriptions and the raw CSV are encrypted at rest;
      // only the derived summary is returned to the client.
      const detail: StatementDetail = {
        ...toListItem(statement),
        summary,
      };
      reply.code(201);
      return detail;
    },
  );
}
