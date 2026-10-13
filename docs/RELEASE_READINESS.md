# Release readiness — 13 October 2026

## Verdict

The repository changes are ready for review and deployment preparation. A public
rollout still requires applying `0002_public_launch.sql` to the production
Supabase project and completing the live gates in `DEPLOYMENT.md`. Do not treat
an existing Vercel deployment or a passing build as proof those gates passed.

## Fixed

- Production cannot fall back to unsigned/default development credentials or
  ephemeral JSON storage. Required settings are validated without logging keys.
- Supabase middleware refreshes sessions and forwards cookies correctly.
- Privileged SQL functions are callable only by the service role; browser writes
  cannot bypass validation, lifecycle rules, or parent ownership checks.
- Confirmation qualifies SQL identifiers, checks conversation/proposal ownership,
  serializes requests, and returns one order on retry.
- Manual order/task/activity creation is transactional. Its form no longer fails
  because of a missing intake-only idempotency key.
- Auth and assistant rate limits use shared database buckets; cross-origin
  mutations are rejected; private responses cannot enter shared caches.
- Signup handles pending email verification, with a token-hash confirmation route.
- Invalid dates/timezones and sensitive upstream error bodies are rejected.
- Proposal revisions refresh the form; client task flags survive confirmation;
  send/confirm failures preserve input and allow retry; mobile has sign-out.
- Offline refinement keeps request history. Money extraction no longer mistakes
  section counts and dates for the agreed budget.
- PostCSS is overridden to the patched 8.5.30 release, preserving Next.js 15.
- CI runs types, tests, and the production build; deployment instructions match
  the implemented flows and migrations.

## Validation

- 50 Vitest tests, including actual PostgreSQL-compatible execution of both
  migrations in PGlite and RPC permission/authorization/atomicity checks.
- Local API smoke: signup, intake, refinement, confirmation/retry, task change,
  lifecycle validation, and cross-account isolation.
- Local browser checks: signup, intake preview, explicit 8000 EGP budget,
  confirmation/detail, manual order creation, five main pages at 360px without
  horizontal overflow, and no browser runtime exceptions in those flows.
- Production build and type checking.
- Production dependency audit: zero reported vulnerabilities.

## Still requires the owner's production configuration

- Apply the SQL migration to the real Supabase project; check existing data for
  duplicate confirmations if its unique indexes fail.
- Verify required Vercel variables, especially the stable APP_SECRET and the
  server-only service-role key.
- Configure the signup email template and SMTP; verify delivery and confirmation
  with a fresh email address, then verify session refresh and persisted data.
- Verify real-model intake with a valid AI key and provider spending settings.

The existing production app is `https://tarteeb-indol.vercel.app` (login page was
reachable during review). Its Vercel deployment-specific URL requires Vercel
sign-in. No production Supabase secrets or administrative session were available
in this work session, so these live checks are not claimed as completed.
