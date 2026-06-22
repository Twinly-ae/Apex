# Apex — Roadmap

Phased build plan. Each phase ends with a usable app; nothing is a big-bang.

**Status legend:** ✅ done · 🚧 in progress · ⏳ planned

| Phase | Theme | Status |
| --- | --- | --- |
| 1 | PWA shell, secure login, Today, fast logging | ✅ |
| 2 | Goals-with-deadlines engine, habits, fitness trends | ✅ |
| 3 | Integrations: Hevy, Apple Health, Notion, money | ✅ |
| 4 | AI: briefing, time-blocking, macro tracker, statements, chat | ✅ |
| 5 | Push notifications, data export, deploy | ⏳ |

---

## Phase 1 — Foundation ✅

Secure, installable, mobile-first app with the **Today** screen and sub-15-second
logging on Postgres.

- **Monorepo** (npm workspaces): `apps/web` (React + Vite PWA), `apps/api`
  (Fastify + Prisma), `packages/shared` (Zod schemas → shared types).
- **Auth:** single user, argon2 hashing, encrypted httpOnly session cookie,
  login/logout/me + change-password, rate-limited login, timing-equalized to
  prevent user enumeration. Designed to sit behind Cloudflare Access later.
- **Fast logging:** meals, bodyweight, water (one-tap), tasks — endpoints + UI.
- **Today aggregate:** rules-based briefing, top-3 priorities, macro/water
  progress vs editable recomp targets. Response shape is stable so the Phase 4
  AI briefing drops in without UI changes.
- **PWA:** manifest, generated icons, offline app shell (Workbox precaches the
  shell only — never API/data).
- **Security:** helmet, CORS locked to `APP_ORIGIN`, global + login rate limits,
  secrets in env only (`.gitignore` + `.env.example`).
- **DB:** `User`, `Settings`, `Meal`, `BodyweightEntry`, `WaterLog`, `Task` +
  initial migration + idempotent single-user seed.

## Phase 2 — Goals engine, habits, fitness trends ✅

Turn ambitions into "what do I do *today*," and visualise the recomp.

- **Goals with deadlines → daily pace:** goal + target date → progress %, days
  remaining, on-track/behind status, this week's milestone, and **today's next
  step**. Rules-based now; AI-enriched in Phase 4.
- **Milestones** per goal, ticked off as you go.
- **Habits / streaks:** daily tick-off with current-streak tracking.
- **Manual workouts + training split:** store the Push/Pull/Legs/rest/Upper/
  Lower/rest plan, tick off today's session, log exercises/sets/reps (fallback
  before Hevy auto-import in Phase 3).
- **Trends + charts:** bodyweight, calorie/protein adherence, training volume &
  streak.
- **Today additions:** today's next step, a habits quick-tick row, and the
  planned training session.
- **New tables:** `Goal`, `GoalMilestone`, `Habit`, `HabitLog`, `TrainingPlan`,
  `Workout`, `WorkoutSet`.
- **Needs from you:** nothing — all runtime data entered in-app.

## Phase 3 — Integrations ✅

Stop typing what a machine can fetch. Each integration is a swappable adapter.

- **Hevy (Pro):** auto-import workouts + history; optional completed-webhook.
- **Apple Health ingest:** token-protected endpoint your bridge app POSTs to
  (steps, active energy, heart rate, sleep, bodyweight).
- **Notion:** Twinly **Business Expenses** DB (ID `5de30779-…`) in AED.
- **Money:** manual investing balances with "last updated" — xCube positions
  individually (Aldar, Emaar) + StashAway + cash — net-worth history; bills &
  subscriptions with renewal dates.
- **New tables:** `HealthMetric`, Hevy-backed workouts, `Account`/`Position`/
  `NetWorthSnapshot`, `TwinlyExpense`, `Bill`.
- **Needs from you (env vars only, never chat):** `HEVY_API_KEY`,
  `NOTION_TOKEN`; investing positions + class/gym schedule entered in-app. I
  generate `HEALTH_INGEST_TOKEN`.

## Phase 4 — AI coach ✅

Anthropic (`claude-opus-4-8`) called **only** from the backend; every feature
checks for the key and degrades gracefully (503 / hidden UI) when it's absent.

- **Daily briefing + time-blocked plan** filling free slots around classes/gym.
- **AI macro tracker:** photo or plain text → Claude estimates calories+macros;
  barcode → Open Food Facts.
- **Bank-statement import:** PDF/CSV → server-side parse → Claude categorises →
  spending by category, detected subscriptions, MoM trend, savings rate, tips.
  Encrypted at rest, never exposed to the frontend or git.
- **Weekly reviews** (Twinly + fitness/money) and an **on-demand chat** with
  data access.
- **New tables:** `TwinlySale`, `BankStatement` (encrypted) / `Transaction`,
  `AiMessage`.
- **Needs from you:** `ANTHROPIC_API_KEY`, `ENCRYPTION_KEY` (can generate),
  fixed weekly commitments, savings goal.

## Phase 5 — Polish, notifications, export, deploy ⏳

- **Web push** (opt-in): logging nudges, bills due, gym-streak alerts — each
  toggleable.
- **One-click export** of all data (JSON/CSV).
- **Deploy:** API + Postgres on Railway, PWA on Cloudflare Pages, HTTPS/DNS via
  Cloudflare, optional Cloudflare Access limited to your email.
- **Needs from you:** `VAPID_*` (can generate), domain/Cloudflare access,
  production env vars.

---

## Env-var timeline

| Phase | Vars introduced |
| --- | --- |
| 1 | `DATABASE_URL`, `SESSION_SECRET`, `APP_ORIGIN`, `ADMIN_*`, `VITE_API_URL` |
| 3 | `HEVY_API_KEY`, `NOTION_TOKEN`, `NOTION_EXPENSES_DB_ID`, `HEALTH_INGEST_TOKEN` |
| 4 | `ANTHROPIC_API_KEY`, `ENCRYPTION_KEY` |
| 5 | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

**Rule:** keys live only in host/Railway environment variables — never in chat,
the frontend, or git.
