import type { ReviewType } from "@apex/shared";
import { prisma } from "../db";
import { runText } from "./ai";
import { buildUserContext } from "./context";
import { computeHealth } from "./health";
import { dayString, weekStartString } from "./time";

const PERSONA =
  "You are Apex, the private coach inside a 19-year-old UAEU engineering student's " +
  "personal dashboard. He's in Abu Dhabi, runs an e-commerce gift brand (Twinly), " +
  "trains 5x/week (Push/Pull/Legs/Upper/Lower) and is on a fat-loss + muscle-gain " +
  "recomp (protein first, ~2200 kcal). Time is his scarcest resource. Be direct, " +
  "specific to his real numbers, and motivating — never generic.";

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
    system: `${PERSONA} Write a tight morning briefing in 2–4 sentences. Lead with what matters most today, mention protein/calories remaining, and end with one motivating push. No lists, no preamble.`,
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
    system: `${PERSONA} Build a realistic time-blocked plan for TODAY that maximises his time. Rules: (1) Schedule fixed commitments first. (2) If the "Training today" line names a split (Push/Pull/Legs/Upper/Lower) and it is NOT already logged, you MUST place a ~60–75min gym block for that exact split today — name it (e.g. "Pull session"); if it says REST, do not add a workout. (3) Schedule the open tasks TODAY: size each block to the task's "~Nm" estimate when given (a ~30m task gets a 30-minute block, not an hour), and order them by urgency then priority — anything marked [OVERDUE] or [due today] must be scheduled today, then [P1] before [P2] before [P3]. Use the task's next sub-step as the block label when present (e.g. "Twinly — confirm supplier"). Don't cram more task-hours than realistically fit around the fixed commitments. (4) Fill any remaining slots with goal next-steps. Output ONLY a schedule, one block per line like "07:00–08:00 — <thing>". Keep it to today.`,
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
    system: `${PERSONA} Give exactly 3 short, specific, actionable tips — one for SLEEP (use his REM, deep, efficiency and awake time, not just hours), one for RECOVERY (use HRV vs baseline and resting HR), and one for STRAIN (training & activity load). Reference his real numbers. One tip per line, each starting with "- ". No preamble, no headings.`,
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
    system: `${PERSONA} ${REVIEW_FOCUS[type]} Write a short, structured weekly review (a few short paragraphs or tight bullets). Be honest and specific.`,
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
