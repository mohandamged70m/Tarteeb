# Deployment and public launch

## Production requirements

Use Node.js 22 or 24. Tarteeb builds without secrets for CI, but every protected
production request fails with 503 if the production configuration is missing.
There is no production fallback to development cookies or a local JSON file.

Required environment variables:

| Variable | Purpose |
| --- | --- |
| `APP_URL` | HTTPS origin of the app, e.g. `https://tarteeb-indol.vercel.app` |
| `APP_SECRET` | Stable random secret with at least 32 characters; encrypts AI keys |
| `NEXT_PUBLIC_SUPABASE_URL` | HTTPS origin of the Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe anon key for Supabase Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database credential; never expose in public variables |

`AI_OPERATOR_KEY` is optional. Leave it empty for BYOK/offline operation. If set,
provider costs are charged to the operator; configure a provider spending limit.
Assistant requests are limited per account to 10 per fixed minute and 100 per
fixed UTC day, shared across instances. Auth attempts are limited to 10 per
fixed minute per IP. Vercel supplies the trusted forwarded IP header; on another
Node host, set `TRUST_PROXY=1` only behind a proxy that overwrites that header.
Without a trusted proxy, auth attempts share an `unknown` bucket.

## Supabase setup — apply before deploying the hardened build

1. Create a Supabase project. For a fresh database run `0001_init.sql`, then
   `0002_public_launch.sql` from `supabase/migrations/`, in order. For an existing
   database apply only the pending migration. Do not rerun 0001 against a database
   whose policies already exist.
2. 0002 restricts privileged RPCs to `service_role`, denies direct browser writes,
   makes manual order creation transactional, adds shared rate limits and timestamp
   triggers, and makes intake confirmation serialized/idempotent. Its unique
   indexes deliberately reject existing duplicate confirmations. Investigate any
   duplicates and their related rows before retrying; do not silently delete them.
3. Enable Email auth and **Confirm email**. Set Auth URL Configuration → Site URL
   to `APP_URL` and allow the app's confirmation URL.
4. Change the **Confirm signup** email template's link to:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
   ```

   `/auth/confirm` verifies the token hash, sets a server session, and redirects to
   the app. Invalid/expired links show a safe message on the login page. Signup
   without a session tells the user to check their email instead of pretending
   they are signed in. Configure SMTP for your intended audience; test actual
   delivery to an address outside your Supabase project team.
5. Set the required variables in the deployment host. Back up `APP_SECRET`
   securely: changing it invalidates saved AI keys, which users must re-enter.

## Vercel

The repository already points to `https://tarteeb-indol.vercel.app`. Import this
Next.js repo or reuse its existing Vercel project, set the variables above for the
production environment, and deploy the selected commit. Build command:
`npm run build`. Install command: `npm ci`. Keep the Node runtime at 22 or 24.
A Vercel GitHub status of **success** only proves a deployment completed; it does
not prove database provisioning or email delivery works.

For a separate Node host: build, then `npm start`. `prestart` runs `npm run
check:env` and prints missing variable names, never their values.

## Release gates

- [ ] Apply all pending SQL migrations to the actual production project.
- [ ] Run `npm run check:env` with the host's production configuration.
- [ ] Visit `/api/health`; expect 200 with `{"status":"ok"}`. This checks
  database connectivity only, not migration completeness or SMTP.
- [ ] Sign up with a fresh email, receive the email, confirm, reload, and sign in.
- [ ] Create a manual order with tasks; refresh and verify persistence.
- [ ] Paste a request, answer questions, inspect the refreshed proposal, confirm,
  and retry the same confirmation; verify a single order and correct task flags.
- [ ] Verify a second account cannot read the first account's orders or clients.
- [ ] Save a user AI key, test it, remove it, and verify only its masked hint was
  ever returned. Real-provider behavior must be tested with a valid key.
- [ ] Check mobile navigation, sign-out, and the portfolio's existing app link.

Repository checks: `npm run typecheck`, `npm test`, `npm run build`, and
`npm audit --omit=dev`. CI runs types, tests, and the credential-free build.
The SQL regression suite runs both production migrations in PGlite with
Supabase-like roles and grants; it is not a substitute for the actual deployment
checks above.

## Local development

Copy `.env.example` to `.env`, set a development-only `APP_SECRET`, then run
`npm ci` and `npm run dev`. Without Supabase variables, development uses
`data/dev-db.json` and a signed dev session. Use `node scripts/smoke.mjs` against
a running dev server (`SMOKE_BASE`, default `http://localhost:3100`); it creates
synthetic local test accounts and orders. Do not run that script against a live
Supabase project with email confirmation enabled.
