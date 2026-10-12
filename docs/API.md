# API

Base: same-origin JSON route handlers under `/api`. All require auth (401
otherwise). All validate with Zod (400 + field errors). Mutations return the
created/updated resource only **after commit**.

## Endpoints

| Method + path | Purpose | Key validation |
| --- | --- | --- |
| `POST /api/auth/signup` | dev-backend signup (Supabase backend uses client SDK directly) | email, password≥8, displayName |
| `POST /api/auth/signin`, `POST /api/auth/signout` | dev session create/destroy | email, password |
| `GET /api/conversations` | list my conversations (recent first) | — |
| `POST /api/conversations` | start intake (`{title?}`) | title ≤120 |
| `GET /api/conversations/:id` | thread + latest proposal | ownership 403 |
| `POST /api/intake/message` | `{conversationId, content, timezone, idempotencyKey?}` → assistant turn + proposal draft | content 1..12000 chars |
| `POST /api/intake/answer` | `{conversationId, answers: [{questionId, answer}]}` → re-extract, update proposal | — |
| `POST /api/intake/confirm` | `{conversationId, proposalId, order fields (edited), idempotencyKey!}` → **atomic** order+tasks | full order schema; client ownership |
| `POST /api/ai/test` | `{}` → validates stored/operator key with a tiny prompt | rate-limited 5/min |
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
| `GET /api/settings/ai` | provider/model/keyHint (never the key) | — |
| `PUT /api/settings/ai` | set provider/model/key | key ≥8 chars; allowlisted model |

## Errors

Shape: `{ error: { code, message, fields?, retryable } }`.
Codes: `unauthorized|forbidden|validation|not_found|conflict|ai_bad_output|
ai_provider|ai_timeout|ai_rate_limited|ai_missing_key|oversized|interrupted`.
Provider failures are 502/504 with `retryable: true`; nothing is written on AI
errors. Confirm conflicts (duplicate idempotency key) return `200` with the
existing order (not an error).

## Idempotency

`POST /api/intake/confirm` requires `Idempotency-Key` header (or body
`idempotencyKey`, uuid). Server upserts on unique `(user_id, idempotency_key)`;
double-clicks and retried requests return the single existing order. The UI
generates one key per preview and disables the button while pending.
