# Design system

Grayscale dark UI. No color accents, no gradients. Status is carried by **text +
icon**, never color alone. All surfaces: black / white / neutral grays.

## 1. Palette (Tailwind v4 `@theme`)

| Token | Value | Use |
| --- | --- | --- |
| `--color-ink-950` | `#0a0a0a` | app background |
| `--color-ink-900` | `#111214` | raised surface (sidebar, header) |
| `--color-ink-850` | `#17181b` | cards, composer, preview |
| `--color-ink-800` | `#1f2125` | hover surface |
| `--color-ink-700` | `#2a2d33` | borders (restrained, 1px) |
| `--color-ink-500` | `#8a8f98` | secondary text |
| `--color-ink-300` | `#c9cdd4` | primary text on dark |
| `--color-ink-100` | `#f4f5f6` | highest-emphasis text, primary button bg |
| `--color-ink` (on-light) | `#111214` | primary button text |

Primary action = white button + black text (inverted). Destructive = text + icon
with explicit label (“Cancel order”), not red paint. Focus ring: 2px white outline
offset 2px — always visible.

## 2. Typography

System stack + tabular numerals for money/dates. Scale: 12 (meta) / 14 (body) /
16 (composer) / 20 (panel titles) / 24 (page title only). Message content
`leading-7`, max 70ch. Arabic text renders with the same stack (system Arabic
fallbacks); `dir="auto"` on user content.

## 3. Spacing & layout

4px base; panels `p-4/6`; message gutter `gap-6`; sidebar 260px collapsible to
icon rail on small screens → bottom tab bar on mobile (`Home Orders Clients
Settings`). Home chat column is centered `max-w-[760px]`, fluid on mobile.
Empty state is a centered heading (“What did your client ask for?”) + large
composer + three subtle example chips (click fills, never submits). In-thread
composer is sticky above the mobile tab bar (`bottom-[76px]`, `md:bottom-4`)
with page bottom padding so it never covers messages. User turns are compact
right-aligned bubbles; assistant turns are plain left-aligned text.

## 4. Components

- **Sidebar / MobileNav:** Home, Orders, Clients, Settings + “New intake”.
  Active item = white left tick + semibold label (not color alone).
- **Composer:** dark charcoal rounded-3xl surface, auto-growing multiline
  textarea (to 200px, `Shift+Enter` newline / `Enter` send with IME guard),
  circular send button (up-arrow SVG) bottom-right, disabled when empty or
  working, spinner + “Working…” status, quiet char counter (`12,000` max,
  input preserved on failure).
- **ChatThread:** user compact right-aligned bubble, assistant plain
  left-aligned text with generous spacing; `aria-live="polite"`.
- **OrderPreview:** compact expandable `<details>` section (title, client,
  deliverables, requirements with explicit/suggested counts, deadline +
  interpretation, budget, tasks with client-required/suggested counts) — every field
  editable inline; [Create order] explicit, disabled while pending; same
  idempotency key reused across retries.
- **StatusBadge:** icon glyph + text (“In progress ▸”), never color-only.
- **Empty/Loading/Error/Success/Disabled:** each list and form implements all
  five; skeletons use pulsing gray blocks (disabled under reduced motion).

## 5. Responsive & accessibility

- Breakpoints: `<640` single column + bottom nav; `640–1024` collapsible sidebar;
  `>1024` fixed sidebar + max-w-3xl chat column.
- Contrast ≥ 4.5:1 body text; focus-visible rings everywhere; full keyboard path
  (composer → preview → confirm); `aria-live="polite"` on assistant stream/turn;
  `prefers-reduced-motion` disables pulse/transitions.
- RTL: user-pasted Arabic uses `dir="auto"`; chrome stays LTR in MVP.

## 6. What we avoid

Generic stat-card dashboards, decorative gradients, oversized hero headings,
charts, emoji-as-status, and any control that looks functional but does nothing.

## 7. Brand assets

- `public/tarteeb-logo-white.svg` (full wordmark) and
  `public/tarteeb-icon-white.svg` (standalone T) on dark surfaces; black
  variants kept for future light surfaces. SVG paths are used as supplied.
- `components/Logo.tsx` (`full` | `icon`) renders explicit width/height
  (aspect preserved, no layout shift) with `alt="Tarteeb"`.
- Nav logos link to `/` with `aria-label="Tarteeb home"`; no name text beside
  the wordmark.
- Favicon: `app/icon.svg` (Next file convention → served at `/icon`) — black
  tile + white T at uniform scale for tab-bar contrast.
