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

4px base; panels `p-4/6`; message gutter `gap-3`; sidebar 260px collapsible to
icon rail on small screens → bottom tab bar on mobile (`Home Orders Clients
Settings`). Composer: sticky bottom, multiline textarea (auto-grow to 200px),
Send on `Ctrl/Cmd+Enter`, prominent full-width on Home.

## 4. Components

- **Sidebar / MobileNav:** Home, Orders, Clients, Settings + “New intake”.
  Active item = white left tick + semibold label (not color alone).
- **Composer:** labelled textarea, char count near limit, processing spinner with
  “Working…” text, Retry on failure.
- **ChatThread:** user right-ish plain, assistant on subtle surface; code-free
  prose; timestamps relative + absolute title.
- **OrderPreview:** section list (title, client, deliverables, requirements with
  explicit/suggested tags, deadline + interpretation, budget, tasks) — every field
  editable inline; [Create order] explicit, disabled while pending.
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
