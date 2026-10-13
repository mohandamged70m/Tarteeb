# Test plan

`npm run typecheck`, `npm test`, and `npm run build` must pass. CI runs all three.

- `schemas.test.ts`, `production.test.ts`: boundary validation, impossible dates,
  IANA timezone checks, manual creation without an intake key, production
  configuration failure, and suppression of sensitive upstream error bodies.
- `dates.test.ts`, `offline.test.ts`: relative deadlines, English/Egyptian Arabic
  and mixed requests, unknown budgets, explicit/suggested requirements.
- `rules.test.ts`: order transitions, task progress, and overdue behavior.
- `repo.test.ts`: development-store idempotency, authorization, passwords.
- `crypto.test.ts`: encryption round trips, key hints, invalid secret handling.
- `database.test.ts`: executes 0001 and 0002 in PGlite with Supabase-like roles;
  verifies privileged RPC access denial, owner checks, proposal/conversation
  matching, idempotent confirmation, key reuse rejection, direct-write denial,
  owner RLS reads, atomic manual creation/rollback, and shared rate limiting.

`node scripts/smoke.mjs` against a local dev server checks signup, conversation
creation, offline intake, answers, confirmation/retry, task updates, legal/illegal
transitions, and a second account's isolation.

Browser QA: signup/signin, confirmation feedback, intake → editable preview →
order, refreshed preview values, manual orders with tasks, network failure/retry,
mobile 360px layout on all main pages, sign-out, keyboard focus, and form labels.

The live release gates in `docs/DEPLOYMENT.md` are mandatory before claiming
public-launch readiness. Local SQL/API checks do not verify real Supabase email
delivery, cookie refresh, production persistence, or an actual AI provider.

`middleware.test.ts` verifies same-origin loopback Host handling, cross-origin
rejection, production fail-closed behavior, refreshed cookies on both downstream
requests and responses, and shared limiter Retry-After responses.
