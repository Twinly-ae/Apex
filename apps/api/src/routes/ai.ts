import type { FastifyInstance, FastifyReply } from "fastify";
import {
  type AiChatMessage,
  type AiText,
  chatInputSchema,
  reviewTypeSchema,
} from "@apex/shared";
import { prisma } from "../db";
import {
  type AiMessageParam,
  aiConfigured,
  aiErrorMessage,
  runText,
} from "../lib/ai";
import {
  generateBriefing,
  generateHealthTips,
  generatePaymentsReview,
  generatePlan,
  generateReview,
  getArtifact,
} from "../lib/coach";
import { buildUserContext } from "../lib/context";
import { parseOr400 } from "../lib/http";
import { dayString, weekStartString } from "../lib/time";

function toChat(m: { id: string; role: string; content: string; createdAt: Date }): AiChatMessage {
  return {
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Run an AI generation, surfacing the real reason (credits/key/etc.) on failure. */
async function runAi<T>(
  reply: FastifyReply,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    reply.log.error({ err }, "AI generation failed");
    reply.code(502).send({ error: aiErrorMessage(err) });
    return undefined;
  }
}

export default async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  /* ----- Chat ----- */
  app.get("/chat", async (request) => {
    const msgs = await prisma.aiMessage.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return { configured: aiConfigured(), messages: msgs.map(toChat) };
  });

  app.post("/chat", async (request, reply) => {
    const body = parseOr400(chatInputSchema, request.body, reply);
    if (!body) return;
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured (set ANTHROPIC_API_KEY)" });
      return;
    }
    await prisma.aiMessage.create({
      data: { userId: request.userId, role: "user", content: body.message },
    });

    const history = await prisma.aiMessage.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    const messages: AiMessageParam[] = history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    const answer = await runAi(reply, async () => {
      const ctx = await buildUserContext(request.userId);
      return runText({
        system:
          "You are Apex, the user's private life coach with full view of his data. " +
          "Answer his question or coach him using his real numbers below. Be concise, " +
          "practical, and specific. If he asks for a plan or advice, make it actionable.\n\n" +
          `=== His current data ===\n${ctx}`,
        messages,
        maxTokens: 1024,
        thinking: true,
      });
    });
    if (answer === undefined) return;

    const saved = await prisma.aiMessage.create({
      data: { userId: request.userId, role: "assistant", content: answer },
    });
    return toChat(saved);
  });

  /* ----- Briefing ----- */
  app.get("/briefing", async (request): Promise<AiText> => {
    const a = await getArtifact(request.userId, "briefing", dayString());
    return {
      configured: aiConfigured(),
      text: a?.content ?? "",
      generatedAt: a ? a.updatedAt.toISOString() : null,
    };
  });

  app.post("/briefing", async (request, reply): Promise<AiText | undefined> => {
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured" });
      return;
    }
    const r = await runAi(reply, () => generateBriefing(request.userId));
    if (!r) return;
    return { configured: true, text: r.text, generatedAt: r.generatedAt.toISOString() };
  });

  /* ----- Health tips (recovery / sleep / stress) ----- */
  app.get("/health-tips", async (request): Promise<AiText> => {
    const a = await getArtifact(request.userId, "health-tips", dayString());
    return {
      configured: aiConfigured(),
      text: a?.content ?? "",
      generatedAt: a ? a.updatedAt.toISOString() : null,
    };
  });

  app.post("/health-tips", async (request, reply): Promise<AiText | undefined> => {
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured" });
      return;
    }
    const r = await runAi(reply, () => generateHealthTips(request.userId));
    if (!r) return;
    return { configured: true, text: r.text, generatedAt: r.generatedAt.toISOString() };
  });

  /* ----- Day plan (time-blocking) ----- */
  app.get("/plan", async (request): Promise<AiText> => {
    const a = await getArtifact(request.userId, "plan", dayString());
    return {
      configured: aiConfigured(),
      text: a?.content ?? "",
      generatedAt: a ? a.updatedAt.toISOString() : null,
    };
  });

  app.post("/plan", async (request, reply): Promise<AiText | undefined> => {
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured" });
      return;
    }
    const commitments = (request.body as { commitments?: string } | undefined)
      ?.commitments;
    const r = await runAi(reply, () => generatePlan(request.userId, commitments));
    if (!r) return;
    return { configured: true, text: r.text, generatedAt: r.generatedAt.toISOString() };
  });

  /* ----- Monthly payments review ----- */
  app.get("/payments-review", async (request): Promise<AiText> => {
    const a = await getArtifact(
      request.userId,
      "payments-review",
      dayString().slice(0, 7),
    );
    return {
      configured: aiConfigured(),
      text: a?.content ?? "",
      generatedAt: a ? a.updatedAt.toISOString() : null,
    };
  });

  app.post("/payments-review", async (request, reply): Promise<AiText | undefined> => {
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured" });
      return;
    }
    const r = await runAi(reply, () => generatePaymentsReview(request.userId));
    if (!r) return;
    return { configured: true, text: r.text, generatedAt: r.generatedAt.toISOString() };
  });

  /* ----- Weekly reviews ----- */
  app.get("/review", async (request, reply): Promise<AiText | undefined> => {
    const type = reviewTypeSchema.safeParse(
      (request.query as Record<string, unknown> | undefined)?.type,
    );
    if (!type.success) {
      reply.code(400).send({ error: "type must be twinly|fitness|money" });
      return;
    }
    const a = await getArtifact(
      request.userId,
      `review:${type.data}`,
      weekStartString(),
    );
    return {
      configured: aiConfigured(),
      text: a?.content ?? "",
      generatedAt: a ? a.updatedAt.toISOString() : null,
    };
  });

  app.post("/review", async (request, reply): Promise<AiText | undefined> => {
    const type = reviewTypeSchema.safeParse(
      (request.query as Record<string, unknown> | undefined)?.type,
    );
    if (!type.success) {
      reply.code(400).send({ error: "type must be twinly|fitness|money" });
      return;
    }
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured" });
      return;
    }
    const r = await runAi(reply, () => generateReview(request.userId, type.data));
    if (!r) return;
    return { configured: true, text: r.text, generatedAt: r.generatedAt.toISOString() };
  });
}
