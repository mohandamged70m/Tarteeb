# AGENTS.md — conventions for future coding agents

## Project

Tarteeb: AI-assisted order management for freelancers. Next.js 15 App Router,
TypeScript strict, Tailwind v4 (grayscale dark UI), Supabase (Postgres + Auth),
Zod everywhere, Vitest. Brand via `SITE_NAME` env (`lib/brand.ts`).

## Rules

1. **Docs describe reality.** After changing behavior, update the affected
   `docs/*.md` in the same commit. Never document unimplemented features.
2. **Validate at boundaries.** Every route handler `safeParse`s input with
   `lib/schemas.ts`; AI output is untrusted until Zod accepts it.
3. **Ownership always.** Scope every query by `user_id`; verify referenced rows
   (client/conversation) belong to the caller. Add/keep an authz test.
4. **No silent status changes.** Task edits never move orders; transitions only
   via the table in `lib/types.ts` (`ORDER_TRANSITIONS`).
5. **Progress is derived** (`done/total`), never stored.
6. **Idempotent confirm.** Keep the `(user_id, idempotency_key)` guard; never
   auto-retry confirm without the same key.
7. **Secrets discipline.** No keys in code/logs/client/`NEXT_PUBLIC_*`. Fixed
   `AI_BASE_URL` only — no user-supplied URLs.
8. **Grayscale UI.** Black/white/neutral grays; status = text + icon; keep
   focus rings, `aria-live` on chat, reduced-motion support.
9. **No dead controls.** Every button works or is absent/disabled with a reason.
10. **Commands:** `npm run typecheck`, `npm test`, `npm run build` must pass.
    Windows PowerShell here: use `npm.cmd`, no `tail/head`, no `&&` chains in
    `shell` tool (use `;`).
11. **Commits** at phase boundaries with messages like `phase3: manual orders`.
    Never push/deploy unless the user explicitly authorizes.
