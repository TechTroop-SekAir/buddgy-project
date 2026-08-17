# Buddgy — Dashboard Visual Refactor

> Implementation spec for adopting the `docs/design-ref/` visual design on the dashboard.
> Values here defer to [`DESIGN.md`](./DESIGN.md) once merged — the token tables in that file
> must be updated by Step 1 of this plan.

## Contents

| Section | What's in it |
|---|---|
| [Context](#context) | Why this refactor, what the reference is, what can't be copied |
| [Decisions](#decisions) | The eight confirmed choices governing the work |
| [Corrections to Assumptions](#corrections-to-assumptions) | What reading the code disproved |
| [Step 1 — Design System Foundation](#step-1--design-system-foundation) | Tokens, Tailwind config, Mantine theme, fonts |
| [Step 2 — Dependency and UI Adapters](#step-2--dependency-and-ui-adapters) | lucide-react, Icon/Menu/ActionIcon/Skeleton/Meter |
| [Step 3 — Utils](#step-3--utils) | categoryIcon, 4-tier status, money, locale, date |
| [Step 4 — i18n](#step-4--i18n) | New keys for both locale files |
| [Step 5 — App Shell and Header](#step-5--app-shell-and-header) | AppShellLayout, AppHeader, ProfileMenu, layout route |
| [Step 6 — De-duplicate Page Chrome](#step-6--de-duplicate-page-chrome) | Stripping per-page nav from six pages |
| [Step 7 — CategoryCard](#step-7--categorycard) | The envelope card rework |
| [Step 8 — SummaryBar](#step-8--summarybar) | Stat tiles, fixed geometry, overall-progress card |
| [Step 9 — ForecastBanner and MissingAmountPrompt](#step-9--forecastbanner-and-missingamountprompt) | Restyle |
| [Step 10 — DashboardPage](#step-10--dashboardpage) | Page layout, loading and empty states |
| [RTL Conversion Reference](#rtl-conversion-reference) | Reference → logical-property mapping, icon mirroring |
| [Verification](#verification) | Mechanical gates and the manual pass |
| [Sequencing](#sequencing) | What can merge independently |
| [Open Items](#open-items) | To resolve during implementation |

---

## Context

`docs/design-ref/DashboardPage.tsx.md` is a standalone visual mock of the Buddgy dashboard: rounded-2xl white cards with soft shadows, per-envelope tinted icon chips, thin token-colored progress bars, a 3-tile summary strip, an overall-spending card, and a sticky app header with a gradient accent stripe and pill nav.

The live dashboard is functionally complete but visually flat — plain `rounded-lg` bordered cards, a Mantine `Progress`, a `flex-wrap gap-8` summary row that changes width when the forecast query resolves (a visible layout shift), and a row of bare text links standing in for navigation.

The goal is to adopt the reference's visuals while keeping every React Query hook, query key, invalidation, i18n key, and backend call intact. **No data-layer or API change.**

The reference cannot be copied as-is. It is Tailwind v4 with `@theme` (we are on v3.4.10 with a JS config), it hardcodes ~30 hex values and does runtime alpha math (`statusColor + '18'`), it uses `lucide-react` (not installed), it has no loading/error/empty states, it positions dropdowns with `absolute right-0` (RTL-broken), and it uses `font-bold` and `text-[9px]` — all of which violate `client/CLAUDE.md` or `.claude/commands/design.md`. Every one of those is translated rather than imported.

Outcome: one coherent design system in `tokens.css`, a shared app header replacing per-page nav, and a dashboard that matches the mock with zero layout shift and no accessibility regressions.

## Decisions

| Decision | Choice |
|---|---|
| Scope | Envelope cards + SummaryBar + ForecastBanner + MissingAmountPrompt + DashboardPage grid, **plus** a new app header/shell. **No** right sidebar (Upcoming/Recent), **no** floating AI bar. |
| Icons | Install `lucide-react`; `components/ui/Icon.jsx` is the only module allowed to import it; `utils/categoryIcon.js` maps category name → registry key string. No DB change. |
| Typography | Add `--font-mono` (DM Mono) for money figures only. Keep the existing system sans for body text — DM Sans has no Hebrew coverage. |
| Font weight | Keep the design.md rule: **`font-semibold` (600) max, never `font-bold`.** Money prominence comes from `font-mono` + `text-xl` + `text-text-primary`. |
| Status tiers | Adopt the reference's 4 tiers: `onTrack` <75%, `nearDepletion` 75–89%, **`nearLimit` 90–99% (new)**, `overBudget` 100%+. |
| Status colors | **Split fill/text.** Bars and chips use the reference's bright hexes as `--status-*-fill`; status labels and Badges keep today's darker AA-passing hexes. The bright hexes fail WCAG AA as text on white. |
| Token blast radius | **Accept the app-wide retune.** One design system, not two. Step 1 includes a grep-and-remap sweep because overriding `rounded-lg` changes it 8px→16px for every existing consumer. |
| Header month | **Read-only localized label.** A working picker means lifting `month` into context and rethreading every query key — out of scope, follow-up ticket. |
| Header Add button | **Omitted.** Add buttons stay in the page body where their modals already live. |

## Corrections to Assumptions

- **A month label formatter already exists**: `client/src/utils/date.js` has `getMonthLabel('2026-08-01')` → localized `"August 2026"` / `"אוגוסט 2026"`. Do not create a new helper — only `getDaysRemainingInMonth()` is missing.
- **No other page duplicates the nav.** The five other protected pages each render only a single `nav.backToDashboard` link plus a `div.p-8` wrapper, so extracting the header is a 2-line deletion per page.
- **Tailwind v3 opacity modifiers do not work on `var()` colors** — the reference's `border-slate-200/70` cannot become `border-border-card/70`. The token value must bake in the blend.
- **Every existing envelope has `color: null`.** `envelopes.color` is in `PUBLIC_ATTRIBUTES` (`server/services/envelopeService.js:21`) and comes back on every list, but no UI ever writes it. A color-from-DB strategy would render the whole dashboard grey — so per-envelope color is **derived deterministically from the name** instead.
- `Progress` has exactly one consumer (`CategoryCard`), so replacing it with a token-only `Meter` has no ripple.

---

## Step 1 — Design System Foundation

One atomic change. `DESIGN.md` and `client/CLAUDE.md` both require tokens.css + tailwind.config.js + theme.js to move together. All values below are derived from the reference's hexes (Tailwind `slate`/`sky`/`rose`/`violet`/`emerald`/`orange`/`cyan` families), named semantically so the palette stays swappable.

### `client/src/styles/tokens.css`

- **Surfaces** — `--bg-page: #f8fafc` (was `#f7f8fa`); `--bg-surface`, `--bg-input` unchanged; **new** `--bg-subtle: #f1f5f9` (progress track, active nav pill) and `--bg-hover: #f8fafc` (row/button hover).
- **Text** — `--text-primary: #0f172a`, **new** `--text-strong: #1e293b` (card/section titles), `--text-secondary: #334155`, `--text-muted: #94a3b8`.
- **Borders** — `--border-card` / `--border-nav`: `#e6ebf2` (slate-200 pre-blended at ~70% over white, since the `/70` modifier is unavailable); **new** `--border-subtle: #f1f5f9` for list-row dividers.
- **Interactive** — `--accent` / `--accent-subtle` **unchanged**. Deliberate: white on the reference's `#38bdf8` is ~1.9:1 and fails AA.
- **Status, text tier** (unchanged values, already AA on white) — `--status-ok: #2f9e58`, `--status-warning: #d98c1f`, **new `--status-critical: #b45309`** (the 90–99% tier), `--status-danger: #d9483a`, `--status-forecast-alert: #b5350f`.
- **Status, fill tier** (the reference's bright hexes — **`background-color` only, never text**) — `--status-ok-fill: #34d399`, `--status-warning-fill: #facc15`, `--status-critical-fill: #fb923c`, `--status-danger-fill: #f57373`.
- **Status, tint backgrounds** (replaces the reference's runtime `statusColor + '18'`) — `--status-ok-tint: #eafaf3`, `--status-warning-tint: #fefbe8`, `--status-critical-tint: #fff4e8`, `--status-danger-tint: #fdeeee`.
- **Envelope accent palette** — `--cat-1..6` + matching `--cat-N-tint`, from the reference's color/bg pairs: sky `#38bdf8`/`#f0f9ff`, rose `#f57373`/`#fff5f5`, violet `#a78bfa`/`#faf5ff`, emerald `#34d399`/`#f0fdf4`, orange `#fb923c`/`#fff7ed`, cyan `#22d3ee`/`#ecfeff`; plus `--cat-fallback: #94a3b8` / `--cat-fallback-tint: #f8fafc`.
- **Brand gradient** — `--brand-gradient` (`135deg`, rose→sky) for decorative surfaces; `--brand-gradient-strong` (`#c93f3f`→`#1470ad`, white text ≈4.7:1) for **any gradient surface bearing text**; `--brand-stripe` (the 90deg 4-stop header stripe).
- **Radius (new category, names per design.md §9)** — `--radius-sm: 0.5rem`, `--radius-md: 0.75rem`, `--radius-lg: 1rem`, `--radius-pill: 9999px`.
- **Shadow (new)** — `--shadow-sm` / `--shadow-md` / `--shadow-lg`, slate-tinted (`rgb(15 23 42 / …)`) rather than pure black.
- **Typography (new)** — `--font-sans` (system stack incl. `'Noto Sans Hebrew'`), `--font-mono: 'DM Mono', ui-monospace, …`, `--text-2xs: 0.6875rem` (11px — the floor; replaces the reference's `text-[11px]`/`[10px]`/`[9px]`).
- **Motion (new)** — `--duration-fast: 150ms`, `--duration-base: 200ms`, `--duration-slow: 700ms`.

### `client/tailwind.config.js`

Extend `colors` with every new token above (`bg-subtle`, `bg-hover`, `text-strong`, `border-subtle`, `status-critical`, all four `status-*-fill`, all four `status-*-tint`, `cat-1..6` + tints, `cat-fallback` + tint), keeping existing entries verbatim. Then add:

- `backgroundImage`: `brand-gradient`, `brand-gradient-strong`, `brand-stripe`
- `borderRadius`: `sm` / `md` / `lg` / `pill` → the radius tokens
- `boxShadow`: `sm` / `md` / `lg` → the shadow tokens
- `fontFamily`: `sans` / `mono` → the font tokens
- `fontSize`: `2xs` → `['var(--text-2xs)', { lineHeight: '1rem' }]`
- `transitionDuration`: `fast` / `base` / `slow`

> **Blast radius — must be handled in this step.** Overriding `borderRadius.sm/md/lg` and `boxShadow.sm/md/lg` inside `extend` **replaces** Tailwind's defaults for those keys. `rounded-lg` goes 8px → 16px for every existing consumer (every card and Modal className in the app). After editing the config, grep every `rounded-*` and `shadow-*` under `client/src/` and re-map each to the intended new name. Skipping this leaves several pages subtly wrong in a way that is hard to trace later.

### `client/src/theme.js`

The file already reads tokens at runtime via `getComputedStyle`; extend that pattern:

- `fontFamily` ← `--font-sans` (replaces the hardcoded `'system-ui, -apple-system, sans-serif'`)
- `fontFamilyMonospace` ← `--font-mono`
- `defaultRadius: 'md'` + `radius: { sm, md, lg }` from the radius tokens
- `shadows: { sm, md, lg }` from the shadow tokens
- `colors['status-critical'] = Array(10).fill(readToken('--status-critical') || '#b45309')` — **required**, or `<Badge color="status-critical">` renders unstyled

Fill-tier colors are deliberately **not** added to the Mantine theme; nothing Mantine-rendered should use them.

### Fonts

Add `<link rel="preconnect">` + a `<link rel="stylesheet">` for `DM Mono:wght@400;500` to `client/index.html`. Only DM Mono. Do **not** use the reference's CSS `@import` — a remote `@import` is render-blocking and chains behind the bundle. (If it must live in CSS, it has to be the first statement in `src/index.css`, above the tokens import.)

### Docs

Update the token tables in [`DESIGN.md`](./DESIGN.md) §Palette & Tokens, §Status Colors, and §Typography in this same change — that file currently says values are "a Track A decision to fill in".

**Verify:** `npm --prefix client run build`, then eyeball all nine pages. This step alone re-skins the whole app.

---

## Step 2 — Dependency and UI Adapters

`npm --prefix client i lucide-react`, then create these and export all five from `src/components/ui/index.js`:

| File | Purpose |
|---|---|
| `Icon.jsx` | **The only module in the app allowed to import `lucide-react`.** Owns `ICON_REGISTRY` (semantic name → lucide component) and a named `SIZES = { xs:12, sm:14, md:16, lg:18 }` scale. API: `<Icon name="wallet" size="sm" className="text-cat-1" />`. `aria-hidden="true"` by default; a `title` prop switches it to `role="img"`. A `flipInRtl` prop applies `rtl:-scale-x-100`. Unknown name → fallback icon + dev warning, never a crash. |
| `Menu.jsx` | Thin pass-through of Mantine `Menu` + `Menu.Target/Dropdown/Item/Label/Divider`, re-attached as statics — same pattern as the existing `Table.jsx`/`Tabs.jsx`. |
| `ActionIcon.jsx` | Mantine `ActionIcon` — the icon-only trigger primitive. Without it the card "…" button and the header avatar would be raw `<button>`s, which `client/CLAUDE.md` forbids. |
| `Skeleton.jsx` | Mantine `Skeleton`. Required by the async-UX contract; no adapter exists today. |
| `Meter.jsx` | **Token-only `<div>` bar, no Mantine.** `<Meter percent={112} status="overBudget" label={…} />`. Track `h-1.5 w-full rounded-pill bg-bg-subtle overflow-hidden`; fill `h-full rounded-pill transition-[width] duration-slow` with `style={{ width: Math.min(percent,100) + '%' }}` and a `bg-status-*-fill` class from a static map. `role="progressbar"` + `aria-valuenow/min/max` + `aria-label`. When `percent > 100` it also gets `ring-1 ring-inset ring-status-danger` so overspend is visually distinct from exactly-100%. |

**Menu decision — use Mantine `Menu`, not the reference's plain div.** The reference dropdowns have no Escape handling, no outside-click, no focus return, no `aria-expanded`, and position with `absolute right-0`. Mantine's `Menu` provides all of that plus direction-aware placement via `position="bottom-end"`, which resolves correctly under the `DirectionProvider` already in `App.jsx`. Mantine is already bundled, so the cost is ~zero.

No consumers yet after this step.

---

## Step 3 — Utils

- **`src/utils/categoryIcon.js` (new)** — pure util, **zero lucide imports**, mirroring the existing `src/utils/categoryLabel.js` pattern. `getCategoryIconName(name)` returns a registry **key string** (`'shoppingCart'`, `'utensils'`, `'zap'`, …) for the seeded set, `'wallet'` as fallback. `getCategoryAccentIndex(name)` returns `1..6` — explicit for seeded names, otherwise a stable char-sum hash so user-created envelopes keep a consistent color across reloads. No hexes and no JSX here; returning strings is what keeps the lucide boundary intact.
- **`src/utils/categoryStatus.js`** — 4 tiers. Return shape gains one field so the fill/text split needs no second lookup at the call site: `>=1 → { status:'overBudget', color:'status-danger', fill:'status-danger-fill' }`; `>=0.9 → nearLimit / status-critical / status-critical-fill`; `>=0.75 → nearDepletion / status-warning / status-warning-fill`; else `onTrack / status-ok / status-ok-fill`. `percentUsed` stays an **unclamped ratio** — `Meter` and the percent label do their own rounding. `isCategoryAtRisk` and `sortCategoriesBySpent` untouched.
- **`src/utils/money.js`** — keep `formatShekels` (2dp) as the default; add `formatShekelsRounded(agorot)` (`min/maximumFractionDigits: 0`). Use **rounded** on the three stat tiles, the overall-progress footnote, and the card's budget subtitle. Keep **2dp** on the card's Left/Over-by figure (decision-relevant — rounded, ₪0.40 remaining prints "₪0"), the forecast shortfall/recommendation, and everything in transactions/forms.
- **`src/utils/locale.js`** — add `en: 'en-IL'` to `INTL_LOCALES`. One line; fixes the pre-existing bug where English users see Hebrew-formatted money and dates.
- **`src/utils/date.js`** — add `getDaysRemainingInMonth(month)`: `lastDay − today.getDate()` when `month` is the current month, else `null` (a days-remaining count is meaningless for a past/future month). **Reuse the existing `getMonthLabel`** — do not add a month-label helper.
- **`src/utils/month.js`** — unchanged.

---

## Step 4 — i18n

Add to **both** `src/locales/he.json` and `en.json` (structures must stay identical):

```
categoryManagement.status.nearLimit    "קרוב לתקרה" / "Near limit"
categoryManagement.budgetLabel         "תקציב {{amount}}" / "{{amount}} budget"
categoryManagement.spentLabel          "הוצא" / "Spent"
categoryManagement.leftLabel           "נותר" / "Left"
categoryManagement.overByLabel         "חריגה של" / "Over by"
categoryManagement.percentUsed         "{{percent}}% נוצלו" / "{{percent}}% used"
categoryManagement.envelopesHeading    "מעטפות" / "Envelopes"
categoryManagement.safeToSpend         "בטוח לבזבז" / "Safe to spend"
categoryManagement.overallSpending     "הוצאות סה״כ — {{month}}" / "Overall spending — {{month}}"
categoryManagement.remainingOf         "{{remaining}} מתוך {{budget}} נותרו" / "{{remaining}} remaining of {{budget}}"
categoryManagement.cardMenu            "פעולות עבור {{name}}" / "Actions for {{name}}"   (aria-label)
categoryManagement.budgetMeterLabel    "ניצול תקציב {{name}}" / "{{name}} budget usage"  (aria-label)
dashboard.monthMeta_one / _other        "{{month}} · נותרו {{count}} ימים" / "{{month}} · {{count}} days remaining"
nav.imports / nav.plannedExpenses / nav.settings / nav.menu / nav.profileMenu
```

`nav.dashboard`, `nav.transactions`, `nav.admin`, `nav.logout`, `common.appName` already exist and are reused as-is.

Notes:

- **Add real `nav.*` keys** rather than continuing to reuse `csvImport.title` / `plannedExpenses.title` / `calendar.title` as nav labels. The current `/settings` link labelled `calendar.title` is actively misleading. The old keys stay where they belong — as page `<h1>`s.
- **`dashboard.monthMeta` plurals**: i18next v23 gives Hebrew `one/two/many/other`. Verify at runtime whether a `_two` form is needed for "2 days"; if so, add it to both files.
- **`nearLimit` Hebrew wording needs a native reader's review.** "קרוב לתקרה" must be distinguishable at a glance from `nearDepletion` = "מתקרבת לסיום" — the two tiers are 15 points apart and currently sound near-identical.

Deliberately **not** added: keys for the reference's "Add Expense"/"History" card-menu items (no handlers on this page — don't ship dead menu items), the bell, or the dark-mode toggle.

---

## Step 5 — App Shell and Header

New files under `src/components/layout/`:

- **`AppShellLayout.jsx`** — the layout route element: `<div className="min-h-screen bg-bg-page font-sans text-text-primary">` → `<AppHeader />` + `<main className="mx-auto max-w-screen-xl px-6 py-8"><Outlet /></main>`.
- **`AppHeader.jsx`** — `<header className="sticky top-0 z-40 border-b border-border-nav bg-bg-surface">`, opening with the 2px accent stripe `<div className="h-0.5 w-full bg-brand-stripe" />`, then an `h-14 max-w-screen-xl` flex row containing:
  - **Logo** — `<Link to="/dashboard">` with a `h-7 w-7 rounded-sm bg-brand-gradient` chip + `<Icon name="wallet" size="sm" className="text-bg-surface" />` and the `common.appName` wordmark.
  - **Pill nav** — `hidden md:flex flex-1 justify-center gap-0.5`, built from a `NAV` array and rendered with react-router **`NavLink`** (an `<a>`, so no raw-`<button>` violation, and `isActive` replaces the reference's `useState('Dashboard')`). Active `bg-bg-subtle font-medium text-text-primary`; idle `text-text-secondary hover:bg-bg-hover hover:text-text-primary`. Items: Dashboard, Transactions, Planned Expenses, Imports, Settings, and Admin **only when `user.role === 'admin'`** — gating preserved verbatim.
  - **Mobile (<md)** — the nav must not simply vanish: a `md:hidden` `<Menu>` with an `ActionIcon` trigger (`name="menu"`, `aria-label={t('nav.menu')}`) holding the same items.
  - **Month label** — `hidden sm:flex` bordered pill with a `calendarDays` icon + `getMonthLabel(getCurrentMonth())`. Read-only text, not a picker.
  - **`ProfileMenu.jsx`** — split out for readability. `<Menu position="bottom-end">`; target is an `ActionIcon` styled `h-7 w-7 rounded-pill bg-brand-gradient-strong text-xs font-semibold text-bg-surface` showing the first grapheme of `user.name || user.email`, `aria-label={t('nav.profileMenu')}`. Dropdown: a `Menu.Label` block with name + email, then Settings / Imports / Admin (gated), `Menu.Divider`, and Sign out (`color="status-danger"`, `onClick={logout}` from `useAuth`).

**Omitted from the reference**, each for a concrete reason: the bell (no notifications feature), the dark-mode toggle (no dark token set, and Tailwind's `darkMode` isn't configured — shipping it would produce a broken theme), and the gradient Add button (per the decision above).

**Remount safety:** `AppHeader` mounts inside `MantineProvider`/`BrowserRouter`, below `DirectionProvider key={direction}`. All its state is either derived from the URL (`NavLink`) or owned by Mantine `Menu`, so the locale-switch remount merely closes an open menu — no data loss.

### `src/routes.jsx`

Introduce a single layout route (there is none today), wrapping the six protected pages:

```jsx
<Route element={<ProtectedRoute><AppShellLayout /></ProtectedRoute>}>
  <Route path="/dashboard"        element={<DashboardPage />} />
  <Route path="/transactions"     element={<TransactionsPage />} />
  <Route path="/imports"          element={<ImportPage />} />
  <Route path="/settings"         element={<SettingsPage />} />
  <Route path="/planned-expenses" element={<PlannedExpensesPage />} />
  <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
</Route>
```

`/`, `/login`, `/register` stay outside, so no header on landing/login/register. The `ProtectedRoute`, `PublicOnlyRoute`, and `AdminRoute` bodies are untouched.

---

## Step 6 — De-duplicate Page Chrome

Steps 5 and 6 land together — routing and page chrome must be atomic.

`TransactionsPage.jsx`, `ImportPage.jsx`, `SettingsPage.jsx`, `PlannedExpensesPage.jsx`, `AdminPage.jsx`: drop the outer `div.p-8` wrapper (the shell now supplies `<main>`) and the `nav.backToDashboard` link; remove any now-unused `Link` import. **Keep** the `/settings` link inside `PlannedExpensesPage`'s empty state and the `/transactions` button in `ImportPage`. `DashboardPage.jsx`: delete the whole nav `<Link>` row and the logout `Button`.

`nav.backToDashboard` becomes unused in all six — either leave the key in both locale files (harmless) or delete from both together.

---

## Step 7 — CategoryCard

`client/src/components/categories/CategoryCard.jsx`. Every hook, mutation callback, and both modals (`CategoryFormModal`, delete-confirm `Modal`) stay byte-identical. Only the card face changes.

- **Shell** — `Card padding={0}` + `group relative bg-bg-surface border border-border-card rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow duration-base`. At-risk adds **`ring-1 ring-status-warning`** instead of swapping the border color, so the border weight never changes (no 1px reflow).
- **Header row** (`flex items-start justify-between mb-4`) — tinted icon chip `flex h-9 w-9 items-center justify-center rounded-md bg-cat-N-tint` + `<Icon name={getCategoryIconName(name)} size="sm" className="text-cat-N" />`; name `text-sm font-semibold text-text-strong`; subtitle `text-xs text-text-muted mt-0.5` = `categoryManagement.budgetLabel`.
- **Overflow menu** — `<Menu position="bottom-end">` with an `ActionIcon variant="subtle"` trigger (`aria-label={t('categoryManagement.cardMenu', { name })}`), classed `opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-fast`. The reference's hover-only reveal is both keyboard- and touch-inaccessible; this fixes both. Items: Edit, Delete — the two `<Button>`s move off the card face into here.
- **Figures row** (`flex items-end justify-between mb-3`) — left: `text-xs text-text-muted mb-1` label + `font-mono text-xl font-semibold leading-none text-text-primary` value. Right: **`text-end`** (not `text-right`) with the `leftLabel`/`overByLabel` swap and a `font-mono text-sm font-semibold leading-none` figure in the status **text** color.
- **Bar** — `<Meter percent={rawPercent} status={status} label={…} />` replaces `<Progress value={Math.min(...)} />`. The width clamps; the numeric label does not.
- **Footer row** (`flex items-center justify-between mt-2.5`) — `font-mono text-2xs text-text-muted` percent using the **unclamped** value (this is how overspend magnitude becomes visible, which today's clamped Progress hides), plus the at-risk Badge and the status Badge.
- **Status Badge stays visible at every tier** (`variant="light"` for `onTrack` so it recedes). The reference only shows a pill ≥90%, which would leave sub-90% status conveyed by bar color alone — forbidden by [`DESIGN.md`](./DESIGN.md).

**Per-category color, never inline.** A module-level `const CAT_CLASSES = { 1: { chip: 'bg-cat-1-tint', icon: 'text-cat-1' }, … }` keeps the class strings literal so Tailwind's JIT scanner sees them. The index comes from `getCategoryAccentIndex(category.name)` — derived from the name, **ignoring `category.color`**, because every existing row is `null` and honoring an arbitrary DB hex would mean an inline hex style. A future "pick your color" feature should store a token index, not a hex.

---

## Step 8 — SummaryBar

`client/src/components/categories/SummaryBar.jsx`. The current `flex flex-wrap gap-8` with 2 always-present + 3 forecast-conditional figures is the layout-shift source: the card has three distinct widths. Replace with three fixed-geometry blocks whose size never depends on load state.

1. **Primary tiles** — `grid grid-cols-1 sm:grid-cols-3 gap-4`. A local `StatTile`: `flex items-center gap-4 rounded-lg border border-border-card bg-bg-surface p-5 shadow-sm`, with an `h-10 w-10 shrink-0 rounded-md` tinted chip + `Icon` (`trendingUp` / `trendingDown` / `piggyBank`), label `text-xs font-medium text-text-muted`, value `mt-0.5 font-mono text-xl font-semibold text-text-primary`. Tiles: Total Budget, Total Spent, Safe to Spend. Tile 3's **value** becomes `<Skeleton className="h-6 w-24" />` while `isForecastLoading`; on `isForecastError` it falls back to `budget − spent` (the math already in the file).
2. **Forecast row** — `grid grid-cols-1 sm:grid-cols-2 gap-4`: Total Planned Expenses, Total End-of-Month Spend. Loading → two `Skeleton` tiles at the **same height**. Error → one block of identical height with `role="alert"` + `forecast.error`. Never conditionally unmounted → zero shift.
3. **Overall progress card** (reference lines 430–440, moved here from the page for cohesion) — `rounded-lg border border-border-card bg-bg-surface px-6 py-4 shadow-sm`, header row with `categoryManagement.overallSpending` + a `font-mono` percent in the status text color, a `<Meter>`, and a `categoryManagement.remainingOf` footnote.

The `isDeficit` label swap and `text-status-forecast-alert` treatment are preserved exactly.

---

## Step 9 — ForecastBanner and MissingAmountPrompt

**ForecastBanner** — `getForecastBannerState` untouched. Visible state becomes `flex items-start gap-3 rounded-lg border border-status-forecast-alert bg-status-danger-tint p-5 shadow-sm` with a leading `<Icon name="alertTriangle" className="text-status-forecast-alert" />`, the Badge unchanged, headline `text-base font-semibold text-status-forecast-alert`, recommendation `text-sm text-text-secondary`, plus `aria-live="polite"` per design.md §8. Error state: same card shell, muted tint, `role="alert"`.

*Loading state — a judgment call to make during implementation:* return `null` rather than a Skeleton. `SummaryBar` already owns the forecast loading affordance, and two simultaneous spinners for one query reads as broken.

**MissingAmountPrompt** — same card shell. Rows become `flex flex-wrap items-end gap-3 py-3 border-b border-border-subtle last:border-0` (`border-b` and `last:` are block-axis, RTL-safe unchanged). Heading → `text-base font-semibold text-text-strong`. `min-w-[10rem]` → `min-w-40`. `NumberInput`, validation, and per-row submit state untouched.

---

## Step 10 — DashboardPage

`client/src/pages/DashboardPage.jsx`. Every hook, query key, mutation, and `invalidateQueries` call stays **byte-identical**. Only the returned JSX changes:

```
title block (mb-7): h1 text-2xl font-semibold tracking-tight   = dashboard.title
                    p  text-sm text-text-muted mt-0.5          = dashboard.monthMeta
                    + Add Transaction button, aligned to the end
<ForecastBanner …/>                                             mb-7
<SummaryBar …/>          (tiles + forecast row + overall card)   mb-7
<MissingAmountPrompt …/>                                        mb-7
section header:  h2 text-base font-semibold text-text-strong   = categoryManagement.envelopesHeading
                 + Button variant="subtle" size="sm" w/ <Icon name="plus"/> = dashboard.addCategory
grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4  → CategoryCards
```

`xl:grid-cols-3` rather than the reference's 2, because we dropped the right sidebar — a 2-col grid on a 1280px page leaves the cards absurdly wide.

**Loading state**: replace the bare `<p>{t('dashboard.loading')}</p>` with three `Skeleton` stat tiles plus four card-shaped `Skeleton`s at the real card height, so first paint matches final layout. **Empty state**: keep the existing copy and CTA, wrapped in `rounded-lg border border-dashed border-border-card p-10 text-center`.

---

## RTL Conversion Reference

Applies throughout — `client/CLAUDE.md` mandates logical properties only.

| Reference | Ours |
|---|---|
| `text-right` (×3) | `text-end` |
| `text-left` | `text-start` |
| `absolute right-0 top-8` (both dropdowns) | deleted — Mantine `Menu position="bottom-end"` is direction-aware |
| `text-[11px]` / `[10px]` / `[9px]` | `text-2xs` (11px floor) |
| `border-b`, `last:border-0`, `mb-*`, `mt-*`, `py-*` | already block-axis — safe unchanged |
| `gap-*`, `flex-shrink-0`, `justify-between` | flow-relative — safe unchanged |
| any `pl/pr/ml/mr` introduced | `ps-/pe-/ms-/me-` |

**Icon mirroring** (handled in `Icon`'s registry via `flipInRtl`): `ArrowLeftRight` is symmetric — don't mirror. `TrendingUp`/`TrendingDown` — **do not mirror**; rising-to-the-right is the universal financial convention and Hebrew charts follow it, so mirroring would read as the opposite trend. `ChevronDown` is vertical, safe. `ChevronLeft`/`ChevronRight` **must** mirror wherever they mean previous/next — `TransactionsPage`'s existing month stepper is the live case. `LogOut`/`Upload`/`Send` contain directional arrows; leave un-mirrored for set consistency, but flag for a Hebrew reader's review.

---

## Verification

The client has no test suite (`npm test` is a stub), so verification is greps plus a genuinely-walked manual pass.

**Mechanical gates** — worth adding as a `lint:constitution` npm script:

```bash
rg -n "#[0-9a-fA-F]{3,8}\b" client/src --glob '!**/styles/tokens.css'                 # → 0
rg -n "\b(ml|mr|pl|pr)-[0-9a-z]|\b(left|right)-[0-9]|text-(left|right)" client/src    # → 0
rg -n "from '@mantine" client/src --glob '!**/components/ui/**'                        # → 0
rg -n "lucide-react" client/src --glob '!**/components/ui/Icon.jsx'                    # → 0
rg -n "console\.log" client/src                                                        # → 0
rg -n "<button|<input|<select" client/src --glob '!**/components/ui/**'                # → 0
npm --prefix client run build
```

Plus a locale-parity check: flatten both JSON files and assert the key sets are identical.

**Manual pass, per merged step:**

- Both locales × both directions; confirm no component needed a code change to flip (the `client/CLAUDE.md` invariant).
- Widths 320 / 640 / 768 / 1024 / 1440: card grid 1→2→3, stat tiles 1→3, nav collapses to the mobile Menu below `md`.
- **Layout-shift check** (the specific bug being fixed): DevTools throttled to Slow 3G, hard-reload `/dashboard`, record a Performance trace, assert CLS ≈ 0 across the two-phase categories → forecast load.
- **API-parity check**: the Network panel shows exactly the same requests as before — one `GET /api/envelopes?month=…`, one forecast call still gated on `categories.length > 0`. Create / edit / delete / quick-entry each still fire the same invalidations (React Query Devtools).
- **Status tiers**: temporarily tweak a local budget/spent to hit 50% / 80% / 95% / 120% and confirm each tier's color, label, and the over-100% ring.
- **Keyboard-only**: Tab reaches the card "…" menu (must become visible on focus), Enter opens, arrows move, Escape closes and returns focus; Tab reaches the avatar menu and Sign out.
- **Header routing**: present on all six protected pages, absent on `/`, `/login`, `/register`; admin link only for admins; logout still works; locale switch still flips direction without breaking the header.
- **Contrast spot-check**: status text colors on white, `text-text-muted` on `bg-bg-surface`, white on `bg-brand-gradient-strong`; confirm no `--status-*-fill` is ever used as a text color.
- **Screen-reader smoke test** on one card: name, amounts, percent, and status label must all be announced — never color alone.

**Optional but high-value**, given zero existing coverage: a ~30-line Vitest unit test for `getCategoryStatus`'s four tier boundaries (0.749 / 0.75 / 0.899 / 0.9 / 0.999 / 1.0) and `getCategoryAccentIndex` determinism. That's the only pure logic this change touches.

## Sequencing

Steps 1–4 are independently mergeable. Steps 5–6 are one atomic unit. Steps 7–10 are independent of each other.

## Open Items

- **`nearLimit` Hebrew wording** needs a native reader — it must be distinguishable at a glance from `nearDepletion`.
- **Hebrew plural forms** for `dashboard.monthMeta` — verify whether `_two` is required.
- **`formatShekelsRounded` introduces penny-level inconsistency** between summary tiles and detail figures on the same screen. Standard at summary altitude, but users do notice. The alternative is 2dp everywhere and wider tiles.
- Consider adding a line to `client/CLAUDE.md` generalizing the component boundary from "`@mantine/core`" to "any UI or icon library" — that rule is what forces `categoryIcon.js` to return strings rather than components.
- A working **month picker** and a **header-level Add button** were both deliberately deferred; each needs a data-layer or modal-context change. See [Decisions](#decisions).
