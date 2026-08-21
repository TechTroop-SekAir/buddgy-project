# Homepage & Tabs — Fix Plan

## Contents

| Section | What's in it |
|---|---|
| [Context](#context) | Where these came from, what they resolve to |
| [Phase 1 — Bug fixes](#phase-1--bug-fixes) | Ref-forwarding menu bug, onboarding backfill |
| [Phase 2 — Homepage consolidation](#phase-2--homepage-consolidation) | UpcomingEventsCard merge, forecast budget total |
| [Phase 3 — Categories / Envelopes](#phase-3--categories--envelopes) | Edit UX, menu, spending drawer, name uniqueness |
| [Phase 4 — Naming, typography, onboarding page](#phase-4--naming-typography-onboarding-page) | Rename, tabular numerals, `/onboarding` route |
| [Phase 5 — Process](#phase-5--process) | E2E-before-push documentation |
| [Verification](#verification) | How to confirm each fix end-to-end |

---

## Context

A manual walkthrough of the homepage (`client/src/pages/DashboardPage.jsx`) and the other tabs
surfaced a batch of UX defects and two real bugs, recorded in `docs/features/FIXES.md`. This doc
turns those notes into an ordered, executable fix list.

Two notes turned out to share a single root cause: the envelope three-dots menu and the settings
profile menu both park at the top-left of the page and refuse to dismiss because
`client/src/components/ui/ActionIcon.jsx` is a plain function component that swallows the `ref`
Mantine's `Menu.Target` needs as its Floating-UI anchor. One 3-line fix resolves both.

Intended outcome: the homepage becomes the single place for envelopes, forecast, and upcoming
calendar events; onboarding stops ambushing existing users and gets its own route; and the client
E2E suite becomes a documented pre-push gate.

**Decisions made during planning:**
- Missing-amount editing folds *into* `UpcomingEventsCard`; `MissingAmountPrompt` is deleted.
- Onboarding moves to a dedicated `/onboarding` route.
- Category spending details open as a drawer on the homepage (no navigation).
- The E2E gate is documented in `qa.md` only — no git hook.

---

## Phase 1 — Bug fixes

Do these first — they unblock manual testing of everything else.

### 1.1 Forward refs in the UI adapters
Fixes FIXES.md items "three points … at the top of the page" and "profile menu stuck at the top
left".

`client/src/components/ui/ActionIcon.jsx` and `client/src/components/ui/Button.jsx` render
Mantine components without forwarding refs. `Menu.Target` clones its child and attaches a ref to
use as the positioning anchor; with `ref === null` the portalled dropdown falls back to
`top:0; left:0` and outside-click dismissal breaks.

Wrap both in `React.forwardRef` and spread the ref onto the Mantine component. Keep them thin
pass-throughs per `client/CLAUDE.md` § Component Boundary — this adds a ref, nothing else.

Affects `client/src/components/categories/CategoryCard.jsx:101-116` and
`client/src/components/layout/ProfileMenu.jsx:16-25` with no changes to either file. While here,
audit the rest of `client/src/components/ui/` for other adapters used as a `Menu.Target`,
`Tooltip`, or `Popover` child and give them the same treatment.

### 1.2 Onboarding no longer fires for existing users
`server/migrations/20260820000200-add-onboarding-completed-at-to-users.js:8-11` adds
`onboarding_completed_at` as nullable with **no backfill**, so every pre-existing user reads as
"never onboarded".

Add a new migration that backfills existing users — set `onboarding_completed_at = NOW()` for any
user who already has envelopes or income rows (safer than a blunt `created_at` cutoff, since it
keeps genuinely-new empty accounts in the wizard). Write a `down` that nulls exactly the rows the
`up` set, per root `CLAUDE.md` § Database Rules.

---

## Phase 2 — Homepage consolidation

### 2.1 Fold missing-amount entry into `UpcomingEventsCard`, move it to the homepage
Today `client/src/components/plannedExpenses/UpcomingEventsCard.jsx` (Dismiss / Spend per row)
and `client/src/components/categories/MissingAmountPrompt.jsx` (inline amount + Save) are two
cards showing overlapping calendar-derived rows.

- Add an inline amount input to `UpcomingEventsCard` rows whose planned expense has no amount,
  reusing the `NumberInput` + Save pattern already in `MissingAmountPrompt.jsx`.
- Mount `UpcomingEventsCard` on `DashboardPage`, replacing the `MissingAmountPrompt` block at
  `DashboardPage.jsx:195-200`.
- Delete `MissingAmountPrompt.jsx` and its `missingAmountMutation` (`DashboardPage.jsx:106-111`),
  carrying its `forecastQueryKey` invalidation into whatever mutation now saves the amount — the
  staleness rule in `docs/STATE.md` still applies.
- Remove the `UpcomingEventsCard` mount from `client/src/pages/PlannedExpensesPage.jsx:139`
  (FIXES.md: "upcoming events card is unnecesarry" there). Also remove the second mount at
  `client/src/pages/SettingsPage.jsx:227` — the homepage is now the canonical home — and drop the
  now-stale comment at `SettingsPage.jsx:54`.

### 2.2 Include the budget total in "תכנון הוצאות / צפוי"
`summaryBar.plannedExpenses` currently renders `forecast.totalEndOfMonthSpendAgorot`
(`SummaryBar.jsx:217`), which `server/services/forecastService.js:89` computes as
`overallActual + overallPlanned` — actual spend only, no budget.

Surface the total budgeted across all categories alongside it. `totalBudget` already exists in
`forecastService.js:147-148` for `projectedBalanceAgorot`; expose it on the forecast response and
render it in the tile as a "of ₪X budgeted" secondary line. Add the locale key to **both**
`he.json` and `en.json` in the same change.

---

## Phase 3 — Categories / Envelopes

### 3.1 Select the amount on edit
`CategoryFormModal.jsx:88-98` prefills the budget `NumberInput` but never focuses or selects it.
Add focus-with-select-all when the modal opens in edit mode, so typing replaces the old figure.

### 3.2 Move Edit into the three-dots menu
`CategoryCard.jsx:93-100` has a standalone pencil `ActionIcon`; `:112` has a Delete-only dropdown.
Remove the pencil and add an Edit `Menu.Item` above Delete. Both modals stay wired as they are.

### 3.3 Category spending details drawer
Clicking a `CategoryCard` body opens a drawer listing that category's transactions for the current
month. Needs a `Drawer` adapter in `client/src/components/ui/` (add it and export from the barrel
before use — do not import Mantine outside that folder). Fetch via the existing
`transactionService` filtered by envelope; honour the Async UX Contract — skeleton, error alert,
and a real empty state. Keep the card's menu clicks from triggering the drawer.

### 3.4 Unique category names
No uniqueness exists at any layer today. Add all three:
- Migration: unique constraint on `(user_id, month, name)` — follow the pattern in
  `server/migrations/20260818000100-scope-google-event-id-unique.js`. Resolve any pre-existing
  duplicates in the `up` before adding the constraint.
- `server/services/envelopeService.js:58-62` (create) and `:71-81` (update): map the constraint
  violation to a 409 with a clear message.
- `CategoryFormModal.jsx`: render it as an inline field-level error, per the Async UX Contract.

---

## Phase 4 — Naming, typography, onboarding page

### 4.1 Rename the homepage
`dashboard.title` is currently **"לוח בקרה לקטגוריות"** / "Category Dashboard" (not plain
"לוח בקרה" as the original note assumed). Change to "דף הבית" / "Homepage" in both locale files,
and check the sidebar/nav label and any page `<title>` for the same string.

### 4.2 Number font
Money figures already use `font-mono` (DM Mono, loaded in `client/index.html:10-14`). The gap is
that no `font-variant-numeric: tabular-nums` exists anywhere, so any figure falling back to the
Hebrew sans stack misaligns. Add a tabular-numerals rule to `client/src/styles/tokens.css` and
apply it to the money/stat surfaces (`CategoryCard.jsx:123,131,144`, `SummaryBar.jsx:183,265`).
If a genuinely different typeface is wanted instead, that's a `docs/DESIGN.md` change and touches
`tokens.css` + `tailwind.config.js` + `theme.js` together.

### 4.3 Onboarding as a dedicated route
Add `/onboarding` as a route; redirect users with a null `onboarding_completed_at` there from the
authenticated shell, and redirect back to the homepage on finish. Reuse the existing `IncomeStep`
and `CategoriesStep` from `client/src/components/onboarding/`, restyled for full-width, and move
the finish mutation out of `DashboardPage.jsx:117-135` into the new page. Remove
`OnboardingWizardModal` from `DashboardPage.jsx:255-258`. Preserve the current sequential save
order — a failed income save must never mark onboarding complete.

---

## Phase 5 — Process

Add to `.claude/commands/qa.md`: the client Playwright suite must pass before any commit or push.
Root `playwright.config.js` already wires `testDir: './e2e'`, `globalSetup`, and both webServers,
so this is a documentation change, not new tooling. Mirror the rule into the
"Checklist Before Merging a Client Ticket" in `client/CLAUDE.md`.

---

## Verification

1. **Menus** — open an envelope's three-dots menu and the settings profile menu; each anchors to
   its trigger and closes on outside click. Confirm no "Function components cannot be given refs"
   warning in the console.
2. **Onboarding** — run the backfill migration, then log in as a pre-existing user: no wizard. Log
   in as a fresh user: redirected to `/onboarding`. Verify the `down` migration reverses cleanly.
3. **Homepage** — `UpcomingEventsCard` renders with inline amount entry; saving an amount updates
   the forecast tile without a manual refresh. `MissingAmountPrompt` is gone; planned-expenses and
   settings pages no longer show the card.
4. **Categories** — edit prefills and selects the amount; Edit and Delete both live in the menu;
   clicking a card opens the details drawer (check its loading, error, and empty states); creating
   a duplicate name shows an inline error, not a 500.
5. **Tests** — update `e2e/onboarding.spec.js` for the new route and `e2e/envelopes.spec.js` for
   the menu/drawer changes; add an E2E case for duplicate category names. Add server tests for the
   uniqueness 409 and the backfill migration. Then run the full Jest and Playwright suites.
6. **i18n/RTL** — confirm every new string exists in both `he.json` and `en.json`, and that the
   drawer and onboarding page use logical properties only (no `ml/mr/pl/pr`, no `left`/`right`).
