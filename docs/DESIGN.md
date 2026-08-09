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

## Palette & Tokens

Defined in `client/src/styles/tokens.css` (to be created by Track A). Core tokens:

| Token | Role |
|---|---|
| `--bg-page` | Root page background |
| `--bg-surface` | Cards, nav, modals |
| `--bg-input` | Input fields |
| `--text-primary` / `--text-secondary` / `--text-muted` | Text hierarchy |
| `--accent` / `--accent-subtle` | The one interactive color |
| `--border-card` / `--border-nav` | Borders |

Exact hex values are a Track A decision to fill in during Day 1–2 (see [`PLAN.md`](./PLAN.md) ticket A-01) — this file is updated with the final palette once chosen, and that update must also touch `tailwind.config.js` and the Mantine theme override in the same PR.

## Status Colors

Buddgy-specific semantic tokens (referenced in `.claude/commands/design.md` § 7 but defined here):

| Token | Meaning | Notes |
|---|---|---|
| `--status-ok` | Envelope on track | Dedicated token — do not reuse the form-success green |
| `--status-warning` | Envelope near depletion | Amber-toned |
| `--status-danger` | Envelope over budget | Dedicated token — do not reuse the form-error red |
| `--status-forecast-alert` | Projected end-of-month shortfall | Used on the forecast banner, not on individual envelopes |

Kept distinct from `red`/`green` (reserved for form validation and success confirmations) so a user scanning envelope cards isn't confused by two different color systems overlapping.

## Typography

Font family: set once, globally, via `font-sans` on `<body>`. Scale and usage table live in `.claude/commands/design.md` § 5 — this file doesn't duplicate it, only the token *values* (weights, sizes in rem) belong here once chosen by Track A.

## Responsive Breakpoints

Mobile-first. Exact breakpoints follow Tailwind's defaults unless a Buddgy-specific need arises:

| Breakpoint | Width | Primary use |
|---|---|---|
| Base (no prefix) | < 640px | Quick Entry, single-column envelope list — this is the most common real-world usage pattern |
| `md:` | ≥ 768px | Two-column envelope grid |
| `lg:` | ≥ 1024px | Dashboard with side-by-side envelope grid + forecast panel |

## Component Library Boundary

Mantine is the component layer; it is imported **only** inside `client/src/components/ui/`. See `CLAUDE.md` § Stack and `.claude/commands/design.md` § 1 and § 9 for the full rule and rationale (keeps the library swappable — a future swap means rewriting `components/ui/` only, not feature code).
