# Deployment

## Local (no credentials)

```bash
cp .env.example .env
# set APP_SECRET to any 32+ char string (dev only)
npm install
npm run dev   # http://localhost:3000
```

Data lives in `data/dev-db.json` (git-ignored). AI uses the offline assistant
until a key is added in Settings.

## Supabase provisioning

1. Create project at supabase.com → copy URL + anon key + service-role key.
2. SQL editor → paste + run `supabase/migrations/0001_init.sql`.
3. Auth → Providers → Email enabled (default). No callback config needed
   (password sessions, no OAuth in MVP).
4. `.env`: set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, strong `APP_SECRET` (keep a backup —
   rotating it invalidates stored AI keys), `APP_URL`.

## Deploy (Vercel or any Node host)

1. Push repo (do NOT commit `.env`).
2. Set all env vars from `.env.example` in the host dashboard.
3. Build: `npm run build`. Start: `npm start`.
4. Smoke test: signup, manual order, AI test-connection, intake confirm.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| “AI not configured” with a key saved | Wrong key or model not in `AI_ALLOWED_MODELS`; run Test connection |
| Stored key unreadable after env change | `APP_SECRET` rotated — users re-enter keys in Settings |
| Supabase 401s | anon key / URL mismatch; check `APP_URL` |
| Local data reset | `data/dev-db.json` deleted — dev-only, expected |
| Build fails on `crypto` | `APP_SECRET` unset — set any 32+ char value |
