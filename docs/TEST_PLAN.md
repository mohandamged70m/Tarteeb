# Test plan

## Automated (vitest, `tests/`)

1. `schemas.test.ts` — proposal validation accepts good payloads; rejects
   invented-price/deadline gaps per rules, bad enums, oversized arrays.
2. `dates.test.ts` — weekday resolution (“Friday” from Tue 2026-10-13 in
   Africa/Cairo → Fri 16 Oct; “next Friday” → Fri 23 Oct per the documented
   convention), date-only stays date-only, ambiguous flagging.
3. `offline.test.ts` — EN + Egyptian Arabic + mixed fixtures produce proposals
   with explicit/suggested separation and no invented prices.
4. `transitions.test.ts` — only legal order/task transitions pass.
5. `idempotency.test.ts` — double confirm → one order, same id, correct tasks.
6. `authz.test.ts` — cross-user client/order/conversation access denied at repo
   level for both backends' shared logic.

## Manual checklist

- [ ] Signup → onboarding prefs → home empty state with examples.
- [ ] Paste EN request → proposal → edit → confirm → order link; refresh persists.
- [ ] Paste incomplete request → ≤3 questions → answer → proposal updates.
- [ ] AR + mixed-language intake works.
- [ ] Provider failure (bad key) → error + retry, input preserved.
- [ ] Double-click Create → one order.
- [ ] Manual order/client/task CRUD with no AI key.
- [ ] Search/filter/sort + empty states; overdue badge.
- [ ] Mobile 360px layout + bottom nav; full keyboard flow; focus visible.
- [ ] `npm run typecheck`, `npm test`, `npm run build` green.
