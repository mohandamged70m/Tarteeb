# Learning guide

Skills used in this project, in practical learning order. (No
`frontend-design`/`ui-ux-pro-max` skills are installed in this environment, so
the design below follows `docs/DESIGN_SYSTEM.md` directly.)

1. **Next.js App Router** — layouts, route handlers, server vs client components.
   Used in: `app/` everywhere. Learn: routing, `cookies()`, `redirect()`.
2. **TypeScript strict** — domain types + Zod-inferred types. Used in: `lib/`.
   Learn: narrowing, `z.infer`, exhaustive switches.
3. **Tailwind v4 theming** — `@theme` tokens, dark-first. Used in:
   `app/globals.css`, components. Learn: tokens over arbitrary values.
4. **Supabase Auth + Postgres + RLS** — signup/session/policies/migrations.
   Used in: `lib/auth.ts`, `repo.supabase.ts`, `supabase/migrations/`.
   Learn: RLS policies, service-role vs anon, password sessions.
5. **Zod validation** — input + AI-output schemas. Used in: `lib/schemas.ts`,
   every route. Learn: `safeParse`, transforms, error flattening.
6. **LLM structured output** — JSON mode, repair retry, validation gates.
   Used in: `lib/ai/*`. Learn: system/user separation, temperature, timeouts.
7. **WebCrypto AES-GCM** — key encryption at rest. Used in: `lib/crypto.ts`.
   Learn: IV discipline, key derivation from `APP_SECRET`.
8. **Timezone-aware dates** — `Intl`, weekday math, date-only discipline.
   Used in: `lib/dates.ts`. Learn: IANA zones, why “next Friday” is ambiguous.
9. **Vitest** — unit tests for rules, not mirrors. Used in: `tests/`.
   Learn: fixtures in EN/AR, idempotency doubles.
10. **Accessible UI habits** — focus, live regions, reduced motion. Used in:
    components. Learn: `aria-live`, focus-visible, 4.5:1 contrast checks.
