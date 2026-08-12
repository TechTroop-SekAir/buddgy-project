# CLAUDE.md — Frontend Constitution (`client/`)

> Applies to everything under `client/`. Root [`CLAUDE.md`](../CLAUDE.md) still governs (stack,
> naming, non-negotiables) — this file adds client-specific engineering rules on top of it.
> [`docs/DESIGN.md`](../docs/DESIGN.md) is the source of truth for design *values* (palette,
> tokens, breakpoints); `.claude/commands/design.md` for *how to apply them*; this file is the
> source of truth for frontend *engineering* rules. If a `docs/design/` folder (Figma exports)
> shows up later, its specs outrank any improvised styling decision made here.

## Contents

| Section | What's in it |
|---|---|
| [Component Boundary](#component-boundary) | Why `components/ui/` exists and how to extend it |
| [Styling & Design System](#styling--design-system) | Tailwind + tokens, no raw values |
| [i18n & RTL](#i18n--rtl) | Hebrew-default, zero hardcoded strings — **infra pending, see note** |
| [API Integration](#api-integration) | One HTTP client, feature services on top |
| [Async UX Contract](#async-ux-contract) | Loading / error / empty are mandatory, not optional |
| [Structure & Naming](#structure--naming) | Where things live, how files are named |
| [Checklist Before Merging a Client Ticket](#checklist-before-merging-a-client-ticket) | Run this before opening the PR |

---

## Component Boundary

`@mantine/core` (and any future UI library) may be imported **only** inside `src/components/ui/`.
Everywhere else — pages, feature components — import from `components/ui` via its barrel
(`src/components/ui/index.js`).

- **Never** write a raw `<button>`, `<input>`, `<select>`, or unstyled Mantine component directly
  in a page or feature component.
- Existing adapters to reuse as-is: `Button`, `TextInput`, `NumberInput`, `Card`, `Modal`
  (`src/components/ui/*.jsx`). They are deliberately thin pass-throughs — keep new ones that way.
- Need a primitive that doesn't have an adapter yet (e.g. `Select`, `Textarea`, `Badge`)? Add the
  adapter first, export it from the barrel, then use it. Don't reach past the boundary "just this
  once."

## Styling & Design System

- Layout and spacing: Tailwind utility classes.
- Color, radius, typography: CSS custom properties from `src/styles/tokens.css`, surfaced as
  Tailwind colors in `tailwind.config.js` (e.g. `bg-bg-page`, `text-status-ok`) and as the Mantine
  theme in `src/theme.js`.
- **Never** hardcode a hex value, a px border-radius, or a magic size inline. If a value you need
  doesn't have a token, that's a design-system gap, not a license to inline it.
- Adding a new token touches `tokens.css` + `tailwind.config.js` + `theme.js` **in the same PR** —
  this mirrors the rule already stated in `docs/DESIGN.md`.
- Envelope/forecast status must never rely on color alone — pair color with a label or icon
  (accessibility rule from `docs/DESIGN.md`).

## i18n & RTL

Infra is live: `react-i18next`/`i18next` init in `src/i18n.js`, resources in `src/locales/he.json`
and `en.json`, direction/locale owned by `src/context/LocaleContext.jsx`, Mantine RTL wired via
`DirectionProvider` in `src/App.jsx`. Every page and component under `src/` uses this — there is no
remaining hardcoded-string debt to work around.

- **Zero hardcoded Hebrew or English strings in JSX.** Every user-facing string comes from the
  translation system via `t('key')` (`react-i18next`, backed by `src/locales/he.json` /
  `en.json`). Adding a string means adding the key to **both** locale files in the same PR.
- Keys are semantic, not English text: `envelopes.empty.title`, not `t('No envelopes yet')`.
- **Hebrew (`he`) is the default locale, with `dir="rtl"`.** `lang`/`dir` are set once, on
  `<html>`, driven by the locale provider — never per-component.
- Switching locale or direction must require **zero edits to individual components**. If a
  component needs a code change to support RTL, it's using the wrong CSS.
- Mantine: RTL is wired through `MantineProvider`'s direction setting, not per-component props.
- **CSS logical properties only** — `ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`/`text-start`/
  `text-end`. **Never** `ml/mr/pl/pr` or literal `left`/`right` positioning; those break under RTL.

## API Integration

- All HTTP requests go through the centralized axios client: `src/services/api.js`. It already:
  - reads `import.meta.env.VITE_API_URL` (falls back to `http://localhost:4000/api` for local dev)
  - attaches `Authorization: Bearer <token>` from `localStorage`
  - unwraps the `{data, error}` response envelope, so callers receive `data` directly
  - redirects to `/login` on `401` — **don't duplicate this in a component**
- Feature-specific services (`authService.js` and its siblings, e.g. a future
  `envelopeService.js`) wrap `api.js` and are the *only* thing pages/hooks call. Never import
  `axios` directly in a component.
- **Never** hardcode `localhost:4000`, a Railway URL, or any other backend origin in a component or
  service — it always comes from `VITE_API_URL`.

## Async UX Contract

Every async surface (page, form submit, list fetch) must define all three states — there is no
such thing as an async component with only a happy path:

| State | Requirement |
|---|---|
| **Loading** | Content-shaped wait → Skeleton. Action (button click, form submit) → inline Spinner/loading prop on the `Button` adapter. |
| **Error** | `401` → handled by the `api.js` interceptor, don't re-implement. `422` → inline field-level validation errors on the form. `5xx` / network failure → user-friendly toast/alert. Never surface a raw server string or stack trace. |
| **Empty** | Every list (envelopes, transactions, imports, planned expenses) renders a dedicated empty-state component when there's no data. A bare `<div>` or "no data" text is a defect, not a placeholder. |

## Structure & Naming

- `pages/` — route-level components only; no direct `axios`/data-shaping logic — call a service or
  hook.
- `hooks/` — data fetching and derived state (e.g. `useEnvelopes`) lives here, not inline in page
  bodies. `@tanstack/react-query` is already mounted via `QueryClientProvider` in `App.jsx` — use
  it as the server-state layer for anything that hits the API.
- `services/` — one file per API resource, wrapping `services/api.js`.
- `context/` — cross-cutting client state only (see `AuthContext.jsx` for the pattern).
- One component per file, `PascalCase.jsx`, filename matches the component name (per root
  `CLAUDE.md`).

## Checklist Before Merging a Client Ticket

- [ ] Used `components/ui/` adapters — no raw HTML form elements, no bare Mantine imports outside
      that folder
- [ ] No hardcoded strings — every user-facing string is a `t('key')` call
- [ ] No `ml/mr/pl/pr`/`left`/`right` — logical properties only
- [ ] Loading, error, and empty states all implemented for every async surface
- [ ] No hardcoded colors, radii, sizes, or backend URLs
- [ ] Responsive at the breakpoints in `docs/DESIGN.md`
- [ ] No `console.log`
