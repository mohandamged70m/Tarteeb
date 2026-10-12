# PRD — Tarteeb MVP

## 1. Target users

Solo freelancers (design, web dev, writing, media) who receive informal client
requests in English and/or Egyptian Arabic via chat apps and email, and currently
track work in notes apps, spreadsheets, or memory.

## 2. Problem

- Requests arrive as unstructured prose across channels; details live in chat history.
- Freelancers forget scope items, miss deadlines, and under-specify work.
- Converting a message into a task list is manual, repetitive, and error-prone.
- There is no single place showing what was agreed, what is missing, and what is next.

## 3. Product promise

Paste the message. Answer a few sharp questions. Get a clean, editable order with
tasks. Confirm explicitly. Track it to completion. Nothing is invented on your
behalf; nothing becomes “agreed” until you say so.

## 4. User stories

**Onboarding & settings**
1. As a new freelancer I can sign up with email/password and set display name,
   timezone, and default currency so dates and money render correctly.
2. As a user I can add my own AI provider key in Settings and test the connection,
   so I know intake will work before I rely on it.
3. As a user without any AI key I can still create clients, orders, and tasks
   manually, so the app is useful on day one.

**Intake (core)**
4. As a freelancer I can paste a client message on Home and get a structured
   proposal (title, summary, deliverables, requirements, deadline, budget, tasks,
   missing details) that I can edit before confirming.
5. As a freelancer with an incomplete request I get a small set of focused
   follow-up questions (essentials first), and I can answer in my own words or
   mark optional items Unknown / Decide later.
6. As a freelancer I can start a new intake at any time; past conversations
   persist across refresh and navigation.
7. As a freelancer I explicitly press “Create order”; the app creates exactly one
   order (+ tasks) even if I double-click or retry, then links me to it.

**Orders & tasks**
8. As a freelancer I can list orders with search (title/client), status + client
   filters, and sort by created/due date.
9. As a freelancer I can move an order through Draft → Ready → In progress →
   Delivered → Completed (or Cancelled) only via permitted transitions; task
   changes never silently move the order.
10. As a freelancer I see overdue indicators and a task-derived progress bar.
11. As a freelancer I see an activity history of meaningful order changes.

**Clients**
12. As a freelancer I can keep lightweight client records (name + optional contact
    + notes) with related orders; when AI suggests a client I pick an existing one
    or confirm a new one — the app never auto-merges.

## 5. Non-goals (MVP)

Team workspaces, client portals, billing/subscriptions, invoices, channel
integrations, automatic client communication, file uploads, autonomous actions.

## 6. Acceptance criteria (traceable to §11 of the brief)

- [ ] Cross-account access impossible (RLS + server-side ownership checks; tests).
- [ ] Manual CRUD works with no AI key configured.
- [ ] Clear request → editable proposal → one confirmed order with correct tasks.
- [ ] Incomplete request → focused questions; optional unknowns stay unknown.
- [ ] EN + Egyptian Arabic examples produce correct proposals (tests + manual).
- [ ] Relative dates resolve in user timezone, shown before confirmation, date-only
      stays date-only.
- [ ] Malformed AI output never creates an order (Zod rejects; user sees retry).
- [ ] Provider failure preserves conversation and offers retry.
- [ ] Double confirmation creates exactly one order (idempotency key + unique constraint).
- [ ] Refresh persistence for conversations and orders.
- [ ] Accurate task-derived progress; mobile + keyboard usable.
- [ ] `typecheck`, tests, and production build pass.
