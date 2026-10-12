# Implementation plan

## Phase 1 — Spec, architecture, design direction ✅ (this doc set)

Deliverables: all `docs/*.md`, `.env.example`, `AGENTS.md`.
Gate: docs describe the actual build, no imagined features.

## Phase 2 — Foundation, auth, ownership

- Next.js scaffold, Tailwind theme, brand, layout + sidebar/mobile nav.
- Repository interface + local backend + Supabase backend + migration SQL.
- Auth (both backends), session protection middleware, login/signup/onboarding.
- Gate: signup → login → protected pages; cross-user 403 test passes.

## Phase 3 — Manual client / order / task management

- Clients CRUD, orders CRUD + transitions, tasks CRUD, activity log, order detail.
- Gate: full manual flow works with NO AI key; transition tests pass.

## Phase 4 — Intake persistence + AI configuration

- Conversations/messages persistence, Settings AI page (save/test/remove key).
- Adapter interface + OpenAI-compatible client + offline assistant.
- Gate: new intake persists; key test reports success/failure honestly.

## Phase 5 — Extraction, clarification, preview, atomic confirm

- Structured extraction + Zod, clarification Q&A (≤3), editable preview,
  idempotent atomic confirm + order link; no silent post-confirm edits.
- Gate: EN + AR fixtures → proposals; double-confirm → exactly one order.

## Phase 6 — Search/filter, activity, responsive + a11y polish

- Orders search/filter/sort, empty/no-result states, overdue badges, reduced
  motion, keyboard path, contrast pass.
- Gate: manual a11y checklist green.

## Phase 7 — Testing, deployment prep, doc reconciliation

- Vitest suites (authz, schemas, dates, idempotency, transitions), build +
  typecheck clean, `docs/DEPLOYMENT.md` verified step-by-step, docs updated to
  match reality.
- Gate: acceptance criteria in `docs/PRD.md` all checked with evidence.
