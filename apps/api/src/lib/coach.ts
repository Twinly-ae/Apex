import type { ReviewType } from "@apex/shared";
import { prisma } from "../db";
import { runJSON, runText } from "./ai";
import { buildUserContext } from "./context";
import { decrypt } from "./crypto";
import { computeHealth } from "./health";
import { dayString, weekStartString } from "./time";

const PERSONA =
  "You are Apex, the personal AI agent inside a 19-year-old UAEU engineering student's " +
  "private dashboard. He's in Abu Dhabi, runs an e-commerce gift brand (Twinly), " +
  "trains 5x/week (Push/Pull/Legs/Upper/Lower) and is on a fat-loss + muscle-gain " +
  "recomp (protein first, ~2200 kcal). Time is his scarcest resource.\n\n" +
  "Tone — talk like a mate who happens to know his numbers, not a manager:\n" +
  "- Match his energy and register. If he writes short, keep it short; if he's " +
  "casual or joking, sound the same way. Mirror his words for things (he says " +
  "'gym', not 'training session').\n" +
  "- Go easy on blunt orders. Suggest and explain — 'might be worth…', 'could " +
  "try…', 'up to you' — instead of 'you must', 'stop', 'do this now'. Skip the " +
  "drill-sergeant motivation and the lectures.\n" +
  "- Softer wording never means vaguer substance: still give the real numbers, " +
  "still say when something slipped, still act. Gentle, not wishy-washy.\n" +
  "- Stay specific to his actual data, never generic. Plain simple English: " +
  "short sentences, everyday words, no jargon, no filler.";

/** Base persona + long-term memory + the user's standing instructions from Settings. */
export async function personaFor(userId: string): Promise<string> {
  const [s, memories] = await Promise.all([
    prisma.settings.findUnique({
      where: { userId },
      select: { aiInstructions: true },
    }),
    prisma.aiMemory.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: 60,
    }),
  ]);
  const parts = [PERSONA];
  if (memories.length > 0) {
    parts.push(
      "Long-term memory — facts saved across conversations, treat them as true:\n" +
        memories.map((m) => `- ${m.content}`).join("\n"),
    );
  }
  const custom = s?.aiInstructions?.trim();
  if (custom) {
    parts.push(`The user's own standing instructions — always follow them:\n${custom}`);
  }
  return parts.join("\n\n");
}

/**
 * Distill one chat thread into long-term memory: Claude extracts the few
 * lasting facts worth keeping, skipping anything already remembered.
 * Returns the facts it saved (possibly none).
 */
export async function memorizeConversation(
  userId: string,
  conversationId: string,
): Promise<string[]> {
  const msgs = await prisma.aiMessage.findMany({
    where: { conversationId, userId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  if (msgs.length === 0) throw new Error("This chat has no messages yet.");

  const existing = await prisma.aiMemory.findMany({ where: { userId } });
  const existingLines =
    existing.map((m) => `- ${m.content}`).join("\n") || "(none)";
  // Keep the tail of very long chats — the newest messages matter most.
  const transcript = msgs
    .map((m) => `${m.role === "assistant" ? "Apex" : "Him"}: ${m.content}`)
    .join("\n")
    .slice(-20_000);

  const facts = await runJSON<unknown>({
    system:
      "You maintain the long-term memory of a personal AI agent. From the chat transcript, " +
      "extract ONLY facts worth keeping for months: lasting preferences, decisions, plans, " +
      "commitments, deadlines, and personal facts. Skip small talk, one-off numbers the app " +
      "already tracks (today's meals, weights, water), anything speculative, and anything " +
      "already in memory. Each fact is one short plain sentence. " +
      'Respond with ONLY a JSON array of strings, e.g. ["fact one","fact two"]. ' +
      "Return [] if nothing is worth keeping.\n\n" +
      `Already in memory (do not repeat):\n${existingLines}`,
    messages: [
      {
        role: "user",
        content: `Chat transcript:\n${transcript}\n\nExtract the facts to remember (max 6).`,
      },
    ],
    maxTokens: 700,
  });

  const seen = new Set(existing.map((m) => m.content.trim().toLowerCase()));
  const saved: string[] = [];
  const list = Array.isArray(facts) ? facts : [];
  for (const raw of list.slice(0, 6)) {
    if (typeof raw !== "string") continue;
    const content = raw.trim().slice(0, 500);
    if (!content || seen.has(content.toLowerCase())) continue;
    if (seen.size + saved.length >= 100) break; // memory cap, same as the tool
    await prisma.aiMemory.create({
      data: { userId, content, source: "agent" },
    });
    seen.add(content.toLowerCase());
    saved.push(content);
  }
  return saved;
}

export async function getArtifact(
  userId: string,
  kind: string,
  key: string,
): Promise<{ content: string; updatedAt: Date } | null> {
  const a = await prisma.aiArtifact.findUnique({
    where: { userId_kind_key: { userId, kind, key } },
  });
  return a ? { content: a.content, updatedAt: a.updatedAt } : null;
}

async function setArtifact(
  userId: string,
  kind: string,
  key: string,
  content: string,
): Promise<Date> {
  const a = await prisma.aiArtifact.upsert({
    where: { userId_kind_key: { userId, kind, key } },
    create: { userId, kind, key, content },
    update: { content },
  });
  return a.updatedAt;
}

export async function generateBriefing(
  userId: string,
): Promise<{ text: string; generatedAt: Date }> {
  const ctx = await buildUserContext(userId);
  const text = await runText({
    system: `${await personaFor(userId)} Write a tight morning briefing in 2–4 sentences. Lead with what matters most today, mention protein/calories remaining, and end with one easy next step. Keep it relaxed — no hype, no pep talk. No lists, no preamble.`,
    messages: [{ role: "user", content: `My data:\n${ctx}\n\nWrite my morning briefing.` }],
    maxTokens: 400,
  });
  const generatedAt = await setArtifact(userId, "briefing", dayString(), text);
  return { text, generatedAt };
}

export async function generatePlan(
  userId: string,
  commitments?: string,
): Promise<{ text: string; generatedAt: Date }> {
  const ctx = await buildUserContext(userId);
  const stored = await getArtifact(userId, "commitments", "default");
  const fixed = commitments?.trim() || stored?.content || "";
  if (commitments?.trim()) {
    await setArtifact(userId, "commitments", "default", commitments.trim());
  }
  const text = await runText({
    system: `${await personaFor(userId)} Build a realistic time-blocked plan for TODAY that maximises his time. Rules: (1) Schedule fixed commitments first. (2) If the Activity status line says he is sick, injured or on a break, do NOT schedule any gym block — schedule rest and recovery instead. Otherwise: if the "Training today" line names a split (Push/Pull/Legs/Upper/Lower) and it is NOT already logged, you MUST place a ~60–75min gym block for that exact split today — name it (e.g. "Pull session"); if it says REST, do not add a workout. (3) Schedule the open tasks TODAY: size each block to the task's "~Nm" estimate when given (a ~30m task gets a 30-minute block, not an hour), and order them by urgency then priority — anything marked [OVERDUE] or [due today] must be scheduled today, then [P1] before [P2] before [P3]. Use the task's next sub-step as the block label when present (e.g. "Twinly — confirm supplier"). Don't cram more task-hours than realistically fit around the fixed commitments. (4) Fill any remaining slots with goal next-steps. Output ONLY a schedule, one block per line like "07:00–08:00 — <thing>". Keep it to today.`,
    messages: [
      {
        role: "user",
        content: `My data:\n${ctx}\n\nFixed weekly commitments (classes/gym/work):\n${
          fixed || "(none provided — assume a normal study + gym day)"
        }\n\nBuild my time-blocked plan for today.`,
      },
    ],
    maxTokens: 900,
    thinking: true,
  });
  const generatedAt = await setArtifact(userId, "plan", dayString(), text);
  return { text, generatedAt };
}

/** 3 actionable recovery / sleep / stress tips from the day's wellbeing data. */
export async function generateHealthTips(
  userId: string,
): Promise<{ text: string; generatedAt: Date }> {
  const ctx = await buildUserContext(userId);
  const h = await computeHealth(userId);
  const extra =
    `Wellbeing scores today (0–100, higher better except strain): sleep ${h.scores.sleep ?? "?"}, ` +
    `recovery ${h.scores.recovery ?? "?"}, strain ${h.scores.stress ?? "?"}. ` +
    `Sleep architecture: ${h.sleepHours ?? "?"}h asleep, ${h.remHours ?? "?"}h REM, ${h.deepHours ?? "?"}h deep, ${h.awakeHours ?? "?"}h awake, ${h.sleepEfficiency ?? "?"}% efficiency (ideal ≈ 22% REM, 15% deep, >90% efficiency). ` +
    `Recovery is driven by HRV ${h.hrv ?? "?"}ms vs ${h.hrvBaseline ?? "?"}ms baseline, resting HR ${h.restingHr ?? "?"} vs ${h.hrBaseline ?? "?"}, and respiratory rate ${h.respiratoryRate ?? "?"}/min. ` +
    `Strain is the day's total load: training + steps + active energy + resting-HR rise + sleep debt + suppressed HRV. ` +
    `Today's activity: ${h.steps ?? "?"} steps, ${h.activeEnergyKcal ?? "?"} kcal active energy. ` +
    `Recent sleep hours: ${h.sleepSeries.map((p) => p.value).join(", ") || "none"}. ` +
    `Recent resting HR: ${h.rhrSeries.map((p) => p.value).join(", ") || "none"}.`;
  const text = await runText({
    system: `${await personaFor(userId)} Give exactly 3 short, specific, actionable tips — one for SLEEP (use his REM, deep, efficiency and awake time, not just hours), one for RECOVERY (use HRV vs baseline and resting HR), and one for STRAIN (training & activity load). Reference his real numbers. One tip per line, each starting with "- ". No preamble, no headings.`,
    messages: [
      {
        role: "user",
        content: `My data:\n${ctx}\n${extra}\n\nGive me 3 recovery/sleep/strain tips.`,
      },
    ],
    maxTokens: 400,
    thinking: true,
  });
  const generatedAt = await setArtifact(userId, "health-tips", dayString(), text);
  return { text, generatedAt };
}

/**
 * AI review of recurring payments: detects merchants that repeat across
 * months in his imported statements, adds tracked bills, and asks Claude to
 * flag increases, duplicates, and cancel candidates. Cached per month.
 */
export async function generatePaymentsReview(
  userId: string,
): Promise<{ text: string; generatedAt: Date }> {
  const monthKey = dayString().slice(0, 7);
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1))
    .toISOString()
    .slice(0, 10);

  const [bills, txs] = await Promise.all([
    prisma.bill.findMany({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId, day: { gte: since }, kind: "debit" },
      select: { day: true, amountAed: true, category: true, descriptionEnc: true },
    }),
  ]);
  if (bills.length === 0 && txs.length === 0) {
    throw new Error(
      "No bills or imported statements yet — import a bank statement (Money → Statements) or add bills first.",
    );
  }

  // Merchants seen in ≥2 distinct months ≈ recurring payments.
  const groups = new Map<
    string,
    { name: string; months: Set<string>; amounts: number[]; lastDay: string; lastAmount: number }
  >();
  for (const t of txs) {
    let desc = "";
    try {
      desc = decrypt(t.descriptionEnc);
    } catch {
      continue; // encryption off or unreadable — skip the row
    }
    const norm = desc.toLowerCase().replace(/[\d#*]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!norm) continue;
    const g = groups.get(norm) ?? {
      name: desc.slice(0, 40),
      months: new Set<string>(),
      amounts: [],
      lastDay: "",
      lastAmount: 0,
    };
    g.months.add(t.day.slice(0, 7));
    g.amounts.push(t.amountAed);
    if (t.day > g.lastDay) {
      g.lastDay = t.day;
      g.lastAmount = t.amountAed;
    }
    groups.set(norm, g);
  }
  const recurring = [...groups.values()]
    .filter((g) => g.months.size >= 2)
    .sort((a, b) => b.lastAmount - a.lastAmount)
    .slice(0, 30);

  const recurringLines =
    recurring
      .map((g) => {
        const avg = g.amounts.reduce((s, n) => s + n, 0) / g.amounts.length;
        return `${g.name}: seen ${g.amounts.length}x across ${g.months.size} months, avg AED ${Math.round(avg)}, last AED ${Math.round(g.lastAmount)} on ${g.lastDay}`;
      })
      .join("\n") || "none detected from statements";
  const billsLine =
    bills
      .map((b) => `${b.name}: AED ${Math.round(b.amountAed)} ${b.cadence}`)
      .join("; ") || "none tracked";

  const text = await runText({
    system: `${await personaFor(userId)} Review his recurring monthly payments like a sharp CFO. Cover: (1) total estimated monthly recurring spend in AED; (2) each recurring payment worth noting; (3) anything that increased, looks duplicated, or overlaps; (4) what looks cancellable or negotiable and roughly how much that saves per month/year. End with 2–3 concrete actions. Use his real AED numbers; short sections or tight bullets, no preamble.`,
    messages: [
      {
        role: "user",
        content: `Tracked bills:\n${billsLine}\n\nRecurring merchants from my bank statements (last 3 months):\n${recurringLines}\n\nReview my monthly payments.`,
      },
    ],
    maxTokens: 900,
    thinking: true,
  });
  const generatedAt = await setArtifact(userId, "payments-review", monthKey, text);
  return { text, generatedAt };
}

const REVIEW_FOCUS: Record<ReviewType, string> = {
  twinly:
    "Review the Twinly business this week: sales/revenue/profit trend, expenses, and the single most important thing to focus on next week.",
  fitness:
    "Review his fitness & nutrition this week: protein/calorie adherence, training consistency, bodyweight trend, and what to adjust for the recomp.",
  money:
    "Review his money this week: net worth, spending vs savings, and 2–3 concrete actions toward his savings goal.",
};

export async function generateReview(
  userId: string,
  type: ReviewType,
): Promise<{ text: string; generatedAt: Date }> {
  const ctx = await buildUserContext(userId);
  let extra = "";
  if (type === "twinly") {
    const sales = await prisma.twinlySale.findMany({
      where: { userId },
      orderBy: { day: "desc" },
      take: 14,
    });
    extra = `Recent Twinly daily sales (day, revenue AED, orders, cost AED): ${sales
      .map((s) => `${s.day}:${s.revenueAed}/${s.orders}/${s.costAed}`)
      .join("; ") || "none logged"}.`;
  } else if (type === "money") {
    const snaps = await prisma.netWorthSnapshot.findMany({
      where: { userId },
      orderBy: { day: "desc" },
      take: 30,
    });
    extra = `Net-worth history (day:total AED): ${snaps
      .map((s) => `${s.day}:${s.totalAed}`)
      .join("; ") || "none"}.`;
  }
  const text = await runText({
    system: `${await personaFor(userId)} ${REVIEW_FOCUS[type]} Write a short, structured weekly review (a few short paragraphs or tight bullets). Be honest and specific.`,
    messages: [{ role: "user", content: `My data:\n${ctx}\n${extra}\n\nWrite the review.` }],
    maxTokens: 800,
    thinking: true,
  });
  const generatedAt = await setArtifact(
    userId,
    `review:${type}`,
    weekStartString(),
    text,
  );
  return { text, generatedAt };
}
