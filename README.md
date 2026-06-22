# Apex

A private, single-user personal command center — installable PWA + Node API.
Built to log anything in seconds and (later) coach you with AI across health,
tasks, business, and money.

> **Status:** Phase 1 — PWA shell, secure password login, the **Today** screen,
> and fast manual logging (meals, bodyweight, water, tasks) on Postgres.
> Integrations (Hevy, Apple Health, Notion) and AI come in later phases.

---

## Architecture

```
apex/
├─ apps/
│  ├─ web/      React + Vite PWA (mobile-first, dark theme, installable)
│  └─ api/      Fastify + Prisma API (all secrets live here, server-side only)
└─ packages/
   └─ shared/   Zod schemas + types shared by both (one source of truth)
```

- **Auth:** single user, password hashed with argon2, encrypted httpOnly session
  cookie. Built to sit behind **Cloudflare Access** later with no code changes.
- **Live data:** the PWA refetches on open/focus and caches in memory
  (TanStack Query). API responses are **not** persisted to disk by the service
  worker — sensitive data stays off the device cache.

## Prerequisites

- Node 20+ and npm 10+
- A Postgres database (local, or a Railway Postgres plugin)

## Local setup

```bash
# 1. Install everything (npm workspaces)
npm install

# 2. Configure env
cp apps/api/.env.example apps/api/.env     # set DATABASE_URL, SESSION_SECRET, ADMIN_*
cp apps/web/.env.example apps/web/.env      # leave VITE_API_URL empty for the dev proxy

# 3. Generate the PWA icons (one-time; needs the `sharp` devDep)
npm run gen:icons -w @apex/web

# 4. Create the database schema and the single user
npm run db:migrate:dev -w @apex/api         # creates tables
npm run db:seed -w @apex/api                # creates ADMIN_EMAIL user

# 5. Run both apps (API on :8080, web on :5173)
npm run dev
```

Open <http://localhost:5173>, sign in with `ADMIN_EMAIL` /
`ADMIN_INITIAL_PASSWORD`, then change the password in **Settings**.

### Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds shared, then runs API + web together |
| `npm run build` | Builds shared → api → web for production |
| `npm run typecheck` | Type-checks every workspace |
| `npm run db:migrate:dev -w @apex/api` | Create/apply a migration locally |
| `npm run db:seed -w @apex/api` | Seed (or no-op) the single user |

## Environment variables

See `apps/api/.env.example` and `apps/web/.env.example` for the authoritative
lists. Phase-1 essentials:

| Var | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | api | Postgres connection string |
| `SESSION_SECRET` | api | ≥ 32 random chars (`openssl rand -base64 48`) |
| `APP_ORIGIN` | api | Exact web origin; locks CORS + cookies |
| `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` | api | Seed-only credentials |
| `VITE_API_URL` | web | API origin in prod; empty in dev (proxy) |

Later phases add `ANTHROPIC_API_KEY`, `HEVY_API_KEY`, `NOTION_TOKEN`,
`HEALTH_INGEST_TOKEN`, `ENCRYPTION_KEY`, and `VAPID_*` — all server-side only.

## Deploy (Railway + Cloudflare)

**Database + API → Railway**

1. New Railway project → add the **Postgres** plugin (sets `DATABASE_URL`).
2. Add a service from this GitHub repo for the API:
   - **Build:** `npm install && npm run build:shared && npm run build -w @apex/api`
   - **Start:** `npm run db:migrate -w @apex/api && npm run start -w @apex/api`
   - **Variables:** `SESSION_SECRET`, `APP_ORIGIN` (your web URL), `NODE_ENV=production`,
     `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` (then seed once).
3. Seed the user once from the Railway shell: `npm run db:seed -w @apex/api`.

**Web (PWA) → Cloudflare Pages**

- Build command: `npm install && npm run build:shared && npm run build -w @apex/web`
- Output directory: `apps/web/dist`
- Variable: `VITE_API_URL=https://<your-api-domain>`
- `apps/web/public/_redirects` already handles SPA routing.

**Cloudflare (DNS + security)**

- Proxy both hostnames through Cloudflare (orange cloud) for HTTPS everywhere.
- Point `apex.<domain>` → Pages, `api.apex.<domain>` → the Railway API.
- **Cloudflare Access (recommended):** put a self-hosted Access policy in front
  of `apex.<domain>` limited to your email. The app login then becomes a second
  factor. No app changes required.

## Security notes (Phase 1)

- Whole app behind login; no public signup. argon2 password hashing.
- Encrypted, httpOnly, `SameSite=Lax` session cookie; `Secure` in production.
- CORS restricted to `APP_ORIGIN`; helmet headers; login + global rate limits.
- All secrets in env vars only. `.env` is gitignored; `.env.example` documents.
- Service worker precaches the app shell only — never API/data responses.

## Roadmap

- **Phase 2:** goals-with-deadlines pace engine, habits, fitness trends/charts.
- **Phase 3:** Notion (Twinly expenses), Hevy auto workouts, Apple Health ingest
  webhook, manual investing balances (xCube/StashAway), net-worth history.
- **Phase 4:** AI — daily briefing + time-blocked plan, photo/text/barcode macro
  tracker, bank-statement import + tips, weekly reviews, on-demand chat.
- **Phase 5:** web push, data export, deploy polish.
