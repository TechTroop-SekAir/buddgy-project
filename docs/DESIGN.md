# Buddgy — Design

## Contents

| Section | What's in it |
|---|---|
| [Visual Direction](#visual-direction) | Overall feel and constraints |
| [Palette & Tokens](#palette--tokens) | Core color tokens |
| [Status Colors](#status-colors) | Envelope/forecast semantic states |
| [Typography](#typography) | Font, scale |
| [Responsive Breakpoints](#responsive-breakpoints) | Mobile-first rules |
| [Component Library Boundary](#component-library-boundary) | Mantine + `components/ui/` |

Related specs: `.claude/commands/design.md` (component-level patterns and rules — this file is the source of truth for values, that file is the source of truth for how to apply them)

---

## Visual Direction

Calm, trustworthy, financial-but-not-corporate — the app should feel closer to a well-designed personal tool than a bank's dashboard. Money numbers are the most important content on any screen; typography and color should make them scannable at a glance (is this envelope fine, close, or over?) without the user doing math.

Constraints:
- Must work well at the size a phone is used for quick entry ("coffee, 34 shekels" typed one-handed) — see [Responsive Breakpoints](#responsive-breakpoints)
- Must never rely on color alone to convey envelope status — pair color with a label/icon for accessibility

**First-run screens** (`/login`, `/register`, `/onboarding`) carry more decoration than the rest of
the app — a `--brand-gradient-strong` panel, the logo lockup, and (in onboarding) an icon-card grid
— since this is the one place a gradient hero and marketing copy earn their keep. Everywhere else
stays restrained per the palette below. See `client/src/components/layout/AuthLayout.jsx` and
`client/src/components/ui/SelectableCard.jsx` for the reusable pieces.

## Palette & Tokens

Defined in `client/src/styles/tokens.css`. Finalized per `docs/DASHBOARD-REDESIGN.md` Step 1 (supersedes the Day-1 placeholder values). Core tokens:

| Token | Role |
|---|---|
| `--bg-page` / `--bg-surface` / `--bg-input` | Page / card-nav-modal / input backgrounds |
| `--bg-subtle` / `--bg-hover` | Progress track & active nav pill / row-button hover |
| `--text-primary` / `--text-strong` / `--text-secondary` / `--text-muted` | Text hierarchy — `text-strong` is card/section titles |
| `--accent` / `--accent-subtle` | The one interactive color |
| `--border-card` / `--border-nav` / `--border-subtle` | Borders — `border-subtle` is for list-row dividers |
| `--cat-1`…`--cat-6` / `--cat-N-tint` / `--cat-fallback` / `--cat-fallback-tint` | Deterministic per-envelope accent + tinted chip background — see `src/utils/categoryIcon.js` |
| `--brand-gradient` / `--brand-gradient-strong` / `--brand-stripe` | Decorative gradients; `-strong` is required wherever the gradient carries text (the plain gradient fails AA for white text) |
| `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-pill` | Corner radius scale, surfaced as Tailwind's `rounded-sm/md/lg/pill` |
| `--shadow-sm` / `--shadow-md` / `--shadow-lg` | Slate-tinted elevation, surfaced as Tailwind's `shadow-sm/md/lg` |
| `--font-sans` / `--font-mono` | Body text (system stack, Hebrew-safe) / money figures (DM Mono) |
| `--duration-fast` / `--duration-base` / `--duration-slow` | Transition durations |

Any new token touches `tokens.css` + `tailwind.config.js` + `theme.js` in the same PR (per `CLAUDE.md` § Non-Negotiables).

## Status Colors

Buddgy-specific semantic tokens (referenced in `.claude/commands/design.md` § 7 but defined here). Each status has **two tiers**: a text tier (AA-contrast on white; the only tier ever used for text or a `Badge` color) and a fill/tint tier (decorative — progress-bar fill and tinted chip backgrounds; several fail contrast by design and must never be used as a text color).

| Token (text tier) | Meaning | Notes |
|---|---|---|
| `--status-ok` | Envelope on track (< 75% used) | Dedicated token — do not reuse the form-success green |
| `--status-warning` | Envelope near depletion (75–89% used) | Amber-toned |
| `--status-critical` | Envelope near its limit (90–99% used) | Between warning and danger — added alongside the 4-tier status model in `docs/DASHBOARD-REDESIGN.md` |
| `--status-danger` | Envelope over budget (100%+ used) | Dedicated token — do not reuse the form-error red |
| `--status-forecast-alert` | Projected end-of-month shortfall | Used on the forecast banner, not on individual envelopes |

| Token (fill/tint tier) | Pairs with |
|---|---|
| `--status-ok-fill` / `--status-ok-tint` | `--status-ok` |
| `--status-warning-fill` / `--status-warning-tint` | `--status-warning` |
| `--status-critical-fill` / `--status-critical-tint` | `--status-critical` |
| `--status-danger-fill` / `--status-danger-tint` | `--status-danger` |

Kept distinct from `red`/`green` (reserved for form validation and success confirmations) so a user scanning envelope cards isn't confused by two different color systems overlapping. Status must never rely on color alone — every tier also renders a Badge label (see `categoryManagement.status.*` in the locale files).

## Typography

Font family: `--font-sans` (system stack, includes Hebrew coverage) set once, globally, via `font-sans` on `<body>`. Money figures use `--font-mono` (DM Mono, loaded in `client/index.html`) — body text does not, since DM Sans/DM Mono's sans companion has no Hebrew glyphs. Scale and usage table live in `.claude/commands/design.md` § 5. Weight is capped at `font-semibold` (600) app-wide — never `font-bold` — including on monetary figures; prominence there comes from `font-mono` + size + `text-primary`, not weight.

## Responsive Breakpoints

Mobile-first. Exact breakpoints follow Tailwind's defaults unless a Buddgy-specific need arises:

| Breakpoint | Width | Primary use |
|---|---|---|
| Base (no prefix) | < 640px | Quick Entry, single-column envelope list — this is the most common real-world usage pattern |
| `md:` | ≥ 768px | Two-column envelope grid |
| `lg:` | ≥ 1024px | Dashboard with side-by-side envelope grid + forecast panel |

## Component Library Boundary

Mantine is the component layer; it is imported **only** inside `client/src/components/ui/`. See `CLAUDE.md` § Stack and `.claude/commands/design.md` § 1 and § 9 for the full rule and rationale (keeps the library swappable — a future swap means rewriting `components/ui/` only, not feature code).
