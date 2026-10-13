# Tarteeb — AI-assisted order management for freelancers

> **Provisional name.** Rebrand by setting `SITE_NAME` in `.env` (see `lib/brand.ts`).
> “Tarteeb” (ترتيب) is Arabic for “organization / putting things in order”.

Freelancers get scattered client requests over WhatsApp, email, and DMs. Details get
forgotten, scope creeps, and turning a message into organized work takes time.

**Tarteeb** lets a freelancer paste a client message into a ChatGPT-style home screen.
The AI extracts requirements, asks focused follow-up questions about missing essentials,
and prepares an **editable order proposal with actionable tasks**. The freelancer reviews
and explicitly confirms — only then does the order become active.

**Central workflow:** paste message → extract requirements → clarify → review → confirm → manage tasks.

## Features (MVP)

- Email/password auth (Supabase Auth; local dev-cookie session when Supabase is unconfigured)
- AI intake chat: paste message → structured proposal → clarification Q&A → editable preview → explicit confirm
- Manual order + client creation (works with no AI key at all)
- Order lifecycle: Draft → Ready → In progress → Delivered → Completed, plus Cancelled
- Task checklist (To do / In progress / Done); progress derived from tasks, never stored
- Lightweight client records; AI suggests, user confirms — never auto-merges
- Search / filter / sort on orders; activity history per order
- Settings: profile, timezone, currency, BYOK AI configuration with connection test
- English + Egyptian Arabic (incl. mixed input); timezone-aware relative-date resolution
- Idempotent confirmation (no duplicate orders on double-click/retry)

## Tech stack

Next.js 15 App Router · TypeScript (strict) · Tailwind CSS v4 · Supabase
(Postgres + Auth) · Zod validation · OpenAI-compatible chat-completions adapter
(OpenAI by default) · Vitest.

See `docs/ARCHITECTURE.md` for decisions and `docs/DESIGN_SYSTEM.md` for the
grayscale dark UI system.

## Quick start (local, no credentials needed)

```bash
cp .env.example .env
# put any 32+ char string in APP_SECRET (dev only)
npm install
npm run dev
# open http://localhost:3000, sign up, start pasting messages
```

Without Supabase env vars the app runs on a **local file-backed store**
(`data/dev-db.json`, git-ignored) with a dev cookie session, and AI intake uses the
built-in **offline assistant** (deterministic rule-based extractor, clearly labelled).
Everything except real-model AI works end to end.

## Full setup (production-like)

1. Create a Supabase project; apply `supabase/migrations/0001_init.sql`, then
   `0002_public_launch.sql` in order. Configure email confirmation as described
   in `docs/DEPLOYMENT.md`.
2. Fill in `.env`: `APP_SECRET` (≥32 chars, `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`),
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`.
3. `npm run build && npm start`, or deploy (see `docs/DEPLOYMENT.md`).
4. Each user adds their own AI key in **Settings → AI** (BYOK), or set
   `AI_OPERATOR_KEY` as a server-side fallback.

## Commands

| Command            | Purpose                              |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Local dev server                     |
| `npm run build`    | Production build                     |
| `npm start`        | Serve production build               |
| `npm run check:env` | Validate required production settings |
| `npm run typecheck`| Strict type check                    |
| `npm test`         | Unit + production SQL regression tests          |
| `node scripts/smoke.mjs` | Live E2E smoke (needs dev server; `SMOKE_BASE` url) |

## Documentation

- `docs/PRD.md` — users, problem, stories, acceptance criteria
- `docs/USER_FLOWS.md` — onboarding, intake, confirmation, management flows
- `docs/ARCHITECTURE.md` — structure, trust boundaries, data flow, decisions
- `docs/DATABASE.md` — schema, RLS, indexes, migrations
- `docs/AI_WORKFLOW.md` — prompts, schemas, clarification, dates, failures
- `docs/DESIGN_SYSTEM.md` — palette, type, components, accessibility
- `docs/API.md` — routes, validation, auth, errors, idempotency
- `docs/SECURITY.md` — authorization, secrets, logging, input handling
- `docs/IMPLEMENTATION_PLAN.md` — phases and gates
- `docs/TEST_PLAN.md` — automated + manual checks
- `docs/DEPLOYMENT.md` — env, provisioning, deploy, troubleshooting
- `docs/ROADMAP.md` — deferred work
- `docs/LEARNING_GUIDE.md` — skills and learning order
- `AGENTS.md` — conventions for future coding agents

## Limitations (honest)

- No integrations: WhatsApp/email/calendar do not exist here — users paste text manually.
- No file uploads or attachment interpretation.
- No team workspaces, client portals, billing, or invoices.
- AI needs either a user key, an operator key, or it falls back to the offline assistant
  (rule-based; good for structure, not a real model).
- Local dev store is single-process file-backed and disabled in production.
- A passing build is not a public-launch signoff: the production SQL migration,
  SMTP confirmation, durable data, and real-provider AI still need live verification.
