# API

Base: same-origin JSON route handlers under `/api`. All business endpoints require auth (401 otherwise); auth endpoints and
`GET /api/health` are public. All validate with Zod (400 + field errors). Mutations return the
created/updated resource only **after commit**.

## Endpoints

| Method + path | Purpose | Key validation |
| --- | --- | --- |
| `POST /api/auth/signup` | Supabase or local signup; returns requiresEmailConfirmation when email verification is pending | email, password≥8, displayName |
| `POST /api/auth/signin`, `POST /api/auth/signout` | Supabase or local session create/destroy | email, password |
| `GET /api/conversations` | list my conversations (recent first) | — |
| `POST /api/conversations` | start intake (`{title?}`) | title ≤120 |
| `GET /api/conversations/:id` | thread + latest proposal | ownership 403 |
| `POST /api/intake/message` | `{conversationId, content, timezone, idempotencyKey?}` → assistant turn + proposal draft | content 1..12000 chars |
| `POST /api/intake/answer` | `{conversationId, answers: [{questionId, answer}]}` → re-extract, update proposal | — |
| `POST /api/intake/confirm` | `{conversationId, proposalId, order fields (edited), idempotencyKey!}` → **atomic** order+tasks | full order schema; client ownership |
| `POST /api/ai/test` | `{}` → validates stored/operator key with a tiny prompt | shared assistant quota: 10/minute + 100/day |
| `GET /api/orders?search&status&clientId&sort` | list with search/filter/sort | enums validated |
| `POST /api/orders` | manual create (Draft) | order schema |
| `GET /api/orders/:id` | detail + tasks + activity + intake excerpt | ownership 403 |
| `PATCH /api/orders/:id` | edit fields / status transition | transition table enforced |
| `POST /api/orders/:id/tasks` | add task | title required |
| `PATCH /api/orders/:id/tasks/:taskId` | task status/title | enum enforced |
| `DELETE /api/orders/:id/tasks/:taskId` | remove task | — |
| `GET /api/clients?search` | list | — |
| `POST /api/clients` | create | name required |
| `GET /api/clients/:id` | detail + related orders | ownership 403 |
| `PATCH /api/clients/:id` | edit | — |
| `GET /api/settings`, `PATCH /api/settings` | profile/timezone/currency | IANA tz + ISO currency validated |
| `GET /api/settings/ai` | provider/model/keyHint (never the key) + provider registry (id/label/models/default) | — |
| `PUT /api/settings/ai` | set provider/model/key | provider ∈ `openai|anthropic|google|xai|deepseek|offline`; model 1–80 chars; key ≥8 chars |

## Errors

Shape: `{ error: { code, message, fields?, retryable } }`.
Codes: `unauthorized|forbidden|validation|not_found|conflict|ai_bad_output|
ai_provider|ai_timeout|ai_rate_limited|ai_missing_key|oversized|interrupted`.
Provider failures are 502/504 with `retryable: true`; the user message is preserved on AI errors, but no proposal or order is created. Repeating the same confirmation returns `200` with the existing order; reusing
a key for a different intake returns a conflict.

## Idempotency

`POST /api/intake/confirm` requires `Idempotency-Key` header (or body
`idempotencyKey`, uuid). The database serializes confirmation and enforces unique `(user_id, idempotency_key)`;
double-clicks and retried requests return the single existing order. The UI
generates one key per preview and disables the button while pending.

Manual order creation does not require an intake idempotency key. Impossible
calendar dates and invalid IANA timezones fail validation. `/auth/confirm` is a
public token-hash verification route, with a fixed local redirect. Mutating APIs
reject cross-site/origin requests; rate-limited responses include Retry-After.
