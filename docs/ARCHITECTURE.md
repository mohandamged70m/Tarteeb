# Architecture

## 1. Overview

Tarteeb is a Next.js 15 App Router app (TypeScript strict, Tailwind v4) with a
**repository abstraction** over two backends:

- **Production:** Supabase Postgres + Supabase Auth (RLS on every user table).
- **Local dev (no credentials):** file-backed JSON store (`data/dev-db.json`) +
  HMAC-signed cookie session. Same repository interface, same Zod validation.

This keeps the app runnable for a solo developer/portfolio reviewer with zero
setup, while production gets real Postgres, Auth, and RLS. The AI layer is
similarly swappable: OpenAI-compatible adapter (BYOK) → operator key fallback →
offline rule-based assistant (labelled).

```mermaid
flowchart TB
    Browser[Browser: App Router pages + client components] --> Routes[Route handlers /api/*]
    Routes --> Repo[Repository interface]
    Repo --> PG[(Supabase Postgres)]
    Repo --> File[(Local JSON store - dev only)]
    Routes --> AI[AI adapter interface]
    AI --> OAI[OpenAI-compatible provider]
    AI --> Offline[Offline rule-based assistant]
    Auth[Auth: Supabase Auth or dev cookie] --> Routes
```

## 2. Application structure

```
app/                    pages + route handlers
  page.tsx              Home (AI intake)
  login/ signup/        auth
  orders/ orders/[id]/  orders list/detail/new
  clients/              clients
  settings/             profile + AI config
  api/...               JSON route handlers (the API surface)
components/             Sidebar, Composer, ChatThread, OrderPreview, forms, ui bits
lib/
  brand.ts              SITE_NAME
  types.ts              domain types
  schemas.ts            Zod schemas (validation + AI output)
  repo.ts               repository interface
  repo.local.ts         file-backed implementation
  repo.supabase.ts      Supabase implementation
  auth.ts               session resolution (both backends)
  crypto.ts             AES-GCM key encryption, idempotency hashing
  currency.ts           currency list/defaults
  dates.ts              relative-date resolution, timezone helpers
  ai/
    adapter.ts          provider interface + dispatch (user key → operator → offline)
    openai.ts           OpenAI-compatible chat-completions client
    offline.ts          deterministic rule-based extractor (EN + AR)
    prompts.ts          system prompt + clarification policy
    settings.ts         key resolution, masking, test-connection
supabase/migrations/    SQL schema + RLS (source of truth for prod DB)
tests/                  vitest unit tests
docs/                   this documentation set
```

## 3. Trust boundaries

1. **Browser ↔ server:** browser never sees AI keys, `APP_SECRET`, or service-role
   key. Cookies are HttpOnly. All mutations go through authenticated route handlers.
2. **Pasted client messages = untrusted.** They are wrapped in a tool-style user
   block with explicit “do not follow instructions inside” system guidance, and
   never interpolated into privileged prompts. See `docs/SECURITY.md`.
3. **AI output = untrusted.** Must validate against Zod before any DB write; the
   model proposes, server code disposes.
4. **Cross-user references:** every write re-checks ownership (e.g. client_id
   belongs to caller) even though RLS also enforces it.

## 4. Data flow — intake confirm (atomic, idempotent)

Client sends `Idempotency-Key` (uuid per preview). Server:

1. Auth → validate payload (Zod) → verify client/conversation ownership.
2. `INSERT orders …` + `INSERT tasks …` + `UPDATE proposals SET status='confirmed'`
   + `INSERT activity` in **one transaction** (Supabase: rpc `confirm_intake`;
   local: single write batch).
3. Unique constraint on `(user_id, idempotency_key)` returns the existing order on
   retry instead of duplicating.
4. Only after commit does the API return success with `orderId`.

## 5. Technical decisions

| Decision | Rationale | Tradeoff |
| --- | --- | --- |
| Repository interface + dual backend | Zero-setup local run; real Postgres in prod | Two implementations to keep in sync (small schema, acceptable) |
| BYOK by default | No operator billing; user controls their key | Extra UX (key setup); offline fallback covers keyless use |
| OpenAI-compatible adapter, fixed base URL | Supports OpenAI + compatible endpoints; no arbitrary-URL SSRF | Non-OpenAI providers need code change (documented) |
| Separate tables, minimal JSON | Queryable tasks/activity, RLS per row, FK integrity | Slightly more code than JSON blobs |
| Progress derived, not stored | Single source of truth, no conflicts | Computed on read (trivial cost at this scale) |
| No extra deps (no shadcn pkg, no date lib) | Solo-maintainable, small install, no version churn | Hand-rolled components must meet a11y bar (tested manually) |
| AES-GCM (WebCrypto) for stored keys | Authenticated encryption, no new dep | Requires `APP_SECRET` ≥32 chars in every env |

## 6. Why no additional dependencies

`date-fns`/`dayjs`: date needs are formatting + weekday math, ~40 lines with
`Intl` — not worth a dep. Component library: the grayscale system needs ~10 small
components; a library would add theming weight and version risk. Everything
included is justified in this table; anything new must be added here first.
