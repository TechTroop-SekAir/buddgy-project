# Buddgy — Upcoming Events (calendar cost-likelihood + spend prompt)

> **Status: C-13/C-14/A-23 landed on `feature/upcoming-events`.** A-24 — the Dashboard card — is not
> yet built. No new feature merges to `main` after the Aug 19 EOD freeze ([`PLAN.md`](../PLAN.md)
> § Dates); this branch lands in the post-freeze bug-fix/demo-prep window at the earliest, or after
> the demo.

## Contents

| Section | What's in it |
|---|---|
| [Why](#why) | The gap this closes |
| [Decisions](#decisions) | The four product calls already made, and the rejected alternatives |
| [Data Model](#data-model) | The two new `planned_expenses` columns |
| [Sync & Classification](#sync--classification) | How `calendarSyncService.js` changes from filter to classify |
| [API](#api) | Endpoint/param changes |
| [Client — Phase 1](#client--phase-1-planned-expenses-page) | `UpcomingEventsCard` on `/planned-expenses` |
| [Client — Phase 2](#client--phase-2-dashboard) | Same card on the dashboard |
| [Forecast Impact](#forecast-impact) | The regression this must not cause |
| [Failure Handling](#failure-handling) | What happens when Claude fails mid-sync |
| [Definition of Done](#definition-of-done) | Before any ticket below gets checked off |
| [Work Split](#work-split) | Ticket table |
| [Risks](#risks) | The likely ones |

Related specs: [`INTEGRATIONS.md`](../INTEGRATIONS.md) · [`API.md`](../API.md) ·
[`DATABASE.md`](../DATABASE.md) · [`ARCHITECTURE.md`](../ARCHITECTURE.md)

---

## Why

`server/services/calendarSyncService.js`'s `AMOUNT_PATTERN` only stores an event if its title
contains a literal ₪/ILS/NIS amount. Nobody writes "חתונה של דנה ₪500" as a calendar event title —
so the events most likely to actually cost money (weddings, birthdays, flights) are silently
dropped today, and the user never gets a chance to plan for them.

This feature turns sync from *filter* into *classify*: keep every upcoming event, have Claude guess
whether it's likely to cost money, surface the likely ones as "Upcoming events" with a way to
dismiss the false positives and fill in a planned spend for the true ones.

---

## Decisions

| Question | Chosen | Rejected alternatives |
|---|---|---|
| How to detect a likely-costly event with no amount in the title | **Claude classifies each event** (batched, one call per sync) | A static Hebrew/English keyword list — cheaper but misses anything unlisted, and Buddgy already has an established `claudeService.js` pattern for this kind of enrichment |
| What happens when the user says an event won't cost money | **Soft-dismiss + undo** — `is_dismissed` flag, sticky across re-syncs, with a "show dismissed" toggle | A hard `DELETE` — rejected because the next sync's `findOrCreate` would just recreate the row and the dismissal would be lost |
| What "how do you plan to spend for this event" produces | **Plain manual form** (amount + category), no AI involved in the number | An AI-suggested amount — rejected for now to keep the estimate honest and avoid a second AI failure mode on top of classification; can be revisited as an extension |
| Scope of this pass | **Full feature, phased** — Planned Expenses page first (Phase 1), Dashboard card second (Phase 2) | Calendar-page-only — moot, see below |

**Correction to the original framing:** there is no dedicated `/calendar` route. Connect/sync lives
on `client/src/pages/SettingsPage.jsx` (`/settings`); the planned-expense list lives on
`client/src/pages/PlannedExpensesPage.jsx` (`/planned-expenses`). "Its current page" in Phase 1 means
the Planned Expenses page.

---

## Data Model

One migration, `server/migrations/20260819000100-add-cost-likelihood-to-planned-expenses.js`
(naming per [`DATABASE.md`](../DATABASE.md) § Migration Conventions; the `down` drops both columns):

| Column | Type | Notes |
|---|---|---|
| `cost_likelihood` | VARCHAR(10) NOT NULL DEFAULT `'unknown'` | `'likely'` \| `'unlikely'` \| `'unknown'` — set by the classifier. An event whose title carries a parseable amount is always `'likely'`, regardless of what Claude says |
| `is_dismissed` | BOOLEAN NOT NULL DEFAULT false | User said "this won't cost money." Sticky across re-syncs — see [Sync & Classification](#sync--classification) |

Both columns are added to `server/models/plannedExpense.js` and to `PUBLIC_ATTRIBUTES` in
`server/services/plannedExpenseService.js` (9 attrs today → 11). While touching the model, the stale
`google_event_id: { unique: true }` declaration is corrected — migration `20260818000100` already
scoped that uniqueness to `(user_id, google_event_id)`, but the Sequelize model definition was never
updated to match (only matters for `sync()`-based paths, not for migrations, but it's misleading).

No new table — reusing `planned_expenses` means "fill in the amount" is just the existing `PATCH`
endpoint moving a row into `is_confirmed: true`, which the forecast already knows how to consume.

---

## Sync & Classification

`server/services/calendarSyncService.js` changes:

1. Fetch events as today (`MAX_EVENTS_PER_SYNC = 50`, `timeMin: now`, `singleEvents: true`).
2. Run the existing `extractAmountAgorot(title)` on each. A match ⇒ `cost_likelihood: 'likely'`; no
   Claude call needed for that event.
3. Batch every remaining event's title into **one** Claude call —
   `classifyEventCostLikelihood(userId, events)` in `server/services/claudeService.js` — not one call
   per event, to keep sync latency and `ai_calls` volume bounded.
4. Upsert **every** event (not only amount-bearing ones, as today) via the existing `findOrCreate`
   keyed on `{ user_id, google_event_id }` inside the existing `sequelize.transaction`.
5. Re-sync semantics, extending the existing "don't clobber user decisions" rule that already
   protects `envelope_id` and `is_confirmed`:
   - `is_dismissed` is **never** reset by a re-sync.
   - `cost_likelihood` is refreshed only while the row is not dismissed and not confirmed.
6. Returns `{ newEvents, likelyCostly }` (was `{ newEvents }`) so the client can report something
   useful right after a sync.

### The Claude call

Mirrors the existing pattern in `claudeService.js` exactly:

```js
const MODEL_ID = 'claude-3-5-sonnet-20241022'; // same constant already in the file
const MAX_TOKENS = 512;
const CLAUDE_TIMEOUT_MS = 15000;
```

- Vercel AI SDK `generateObject` + a zod schema — no manual JSON parsing.
- Schema: `{ events: [{ google_event_id: string, likely_costly: boolean }] }`.
- Prompt: a `\n`-joined array (no system prompt, no messages array — matches
  `buildPrompt` in the existing quick-entry function), stating the titles are Hebrew-first calendar
  events and defining "likely costly" as a social/travel/purchase obligation (wedding, bar mitzva,
  birthday, flight, hotel, קניות) versus a routine free one (meeting, gym, פגישה).
- **Validate in JS, never trust the model's ids** — the same posture `claudeService.js` already takes
  for `suggested_envelope_id`. Drop any returned `google_event_id` that wasn't in the batch sent.
- Logged via `logAiCall(userId, 'event_cost', succeeded)`. `ai_calls.kind` is `VARCHAR(20)` — a third
  value needs no migration.

---

## API

`docs/API.md` § Calendar & Forecast gains:

```
PATCH  /api/planned-expenses/:id  🔒  → planned_expense   (now also accepts is_dismissed)
GET    /api/planned-expenses?month=2026-08&include_dismissed=true  🔒  → [ planned_expense ]
```

- `server/routes/plannedExpenses.js`: add `is_dismissed` (boolean) to the PATCH validator's allowed
  keys. `cost_likelihood` stays server-assigned and not client-writable, same posture as
  `google_event_id`/`source`.
- `GET` defaults to `is_dismissed: false`; `?include_dismissed=true` returns everything — that's what
  powers "show dismissed / undo" client-side. Filtered in `plannedExpenseService.list`, alongside the
  existing `monthRange` clause.
- Undo is just `PATCH { is_dismissed: false }` — no separate endpoint.

The widened `planned_expense` response shape:

```json
{ "id": 3, "user_id": 1, "envelope_id": 10, "title": "חתונה של דנה", "amount_agorot": null,
  "due_date": "2026-08-20", "google_event_id": "evt_3", "is_confirmed": false, "source": "calendar",
  "cost_likelihood": "likely", "is_dismissed": false }
```

---

## Client — Phase 1 (Planned Expenses page)

New `client/src/components/plannedExpenses/UpcomingEventsCard.jsx`, rendered above the existing
table on `PlannedExpensesPage.jsx`. Built only from `client/src/components/ui/` adapters
(`Card`, `Button`, `Badge`, `Icon`, `EmptyState`) — no direct `@mantine/core` import, per
`client/CLAUDE.md`.

- **Source:** the page's existing `['planned-expenses', user.id, month]` query — no new query key.
  The card filters client-side to `source === 'calendar' && cost_likelihood === 'likely' &&
  !is_confirmed`.
- **Each row:** title, due date, an amount `Badge` when `amount_agorot` is null/0, and two actions:
  - **"לא יעלה כסף"** → `PATCH { is_dismissed: true }`, with an inline undo affordance in the toast/row.
  - **"כמה תוציא?"** → opens a spend modal.
- **Spend modal:** reuses `PlannedExpenseFormModal.jsx` in an edit mode (amount + category) instead
  of a third bespoke amount form — it already overlaps heavily with `MissingAmountPrompt.jsx`.
  Submitting sends `PATCH { amount_agorot, envelope_id, is_confirmed: true }`, which moves the row
  into the forecast's confirmed-total.
- **"show dismissed (N)"** toggle re-fetches with `include_dismissed=true`.
- Returns `null` when there's nothing to show, matching `MissingAmountPrompt`'s convention.

All mutations invalidate both `['planned-expenses', user.id, month]` and
`['forecast', user.id, month]` — the rule `PlannedExpensesPage.jsx` already follows for its own
mutations.

**Bug fixed in the same ticket:** `SettingsPage.jsx`'s sync mutation currently invalidates nothing,
so newly synced events don't appear until a manual reload — independent of this feature, but blocking
it in practice. Add both invalidations there.

i18n: new `plannedExpenses.upcoming.*` keys added to **both** `client/src/locales/he.json` (default
locale) and `en.json` in the same PR, per `client/CLAUDE.md` § i18n & RTL.

## Client — Phase 2 (Dashboard)

Mount the same `UpcomingEventsCard` on `DashboardPage.jsx`, inside the existing
`flex flex-col gap-4` stack, directly after `MissingAmountPrompt`. The dashboard already fetches
forecast + categories; it gains the `['planned-expenses', user.id, month]` query, which shares cache
with the Planned Expenses page for free. The dashboard instance is capped to the next few rows with
a "see all" link to `/planned-expenses`.

---

## Forecast Impact

`forecastService.js` sums only `is_confirmed: true` rows for `totalPlannedExpensesAgorot`, so storing
more rows on its own does not move `projectedBalanceAgorot`. But `missingAmountPlannedExpenses`
(step 8 of [`ARCHITECTURE.md`](../ARCHITECTURE.md) § Forecast Computation) queries *every* in-month
row with a null/0 amount, regardless of confirmation state — once sync stops filtering on amount,
that query would surface every gym session and standup on the user's calendar in the dashboard's
`MissingAmountPrompt`.

**Fix:** `missingAmountPlannedExpenses` additionally requires `cost_likelihood: 'likely'` and
`is_dismissed: false`. `docs/ARCHITECTURE.md` § Forecast Computation step 8 is updated in the same
commit as this change.

---

## Failure Handling

Per [`INTEGRATIONS.md`](../INTEGRATIONS.md) § Failure Handling, a Claude timeout must not fail the
whole sync. This is a **deliberate deviation** from the 422-on-AI-failure rule quick-entry parsing
uses: there, the AI's output *is* the payload; here it's enrichment on top of data that's already
being saved. On a classification failure, catch it, leave the affected rows at
`cost_likelihood: 'unknown'` (excluded from Upcoming Events, but still visible in the plain planned-
expenses table), log `logAiCall(userId, 'event_cost', false)`, and let the sync resolve normally with
`{ newEvents, likelyCostly: 0 }` for that batch.

| Failure | Handling |
|---|---|
| Claude timeout / malformed JSON | Sync still succeeds; affected rows stay `'unknown'`; `ai_calls` logs the failure |
| Google token expired/revoked mid-sync | Unchanged — existing `classifyGoogleApiError` path |
| Every event already has an amount | No Claude call is made at all (step 2 short-circuits step 3) |

---

## Definition of Done

Same checklist as [`PLAN.md`](../PLAN.md#definition-of-done), plus:

- [ ] Matches this spec / [`API.md`](../API.md) / [`DATABASE.md`](../DATABASE.md) exactly — any
      deviation updates the spec in the same PR
- [ ] `server/__tests__/calendarSync.test.js` covers: amount-less event → `'likely'`/`'unlikely'`
      via the mocked classifier; a classifier failure leaves rows `'unknown'` and sync still resolves;
      re-sync never clears `is_dismissed`
- [ ] `server/tests/plannedExpenses.integration.test.js` covers `include_dismissed` and the
      `is_dismissed` PATCH against real Postgres
- [ ] `docs/ARCHITECTURE.md` § Forecast Computation step 8 updated to the scoped query
- [ ] No `console.log`, no hardcoded ids/urls, responsive at [`DESIGN.md`](../DESIGN.md) breakpoints
- [ ] Reviewed by one of the other two before merging to `main`

## Work Split

| Ticket | Owner | Scope |
|---|---|---|
| **C-13** | Ofek | Migration + model/service attrs + classify-on-sync + `claudeService.classifyEventCostLikelihood` + server tests |
| **C-14** | Ofek | `include_dismissed` filter, `is_dismissed` PATCH, forecast `missingAmountPlannedExpenses` scoping |
| **A-23** | Darya | `UpcomingEventsCard` on `/planned-expenses` + spend modal + i18n + the `SettingsPage` invalidation fix |
| **A-24** | Darya | Phase 2 — same card on the Dashboard |

(Numbered past `C-11`/`A-21`/`B-11`, which [`AGENTS.md`](./AGENTS.md) already claims for the
Budget Advisor / Calendar Conflict agents — the two specs share the `planned_expenses` table but are
otherwise independent and can land in either order.)

## Risks

| Risk | Mitigation |
|---|---|
| Claude misclassifies routine Hebrew events as costly, adding noise | Ship with dismiss+undo as the escape hatch from day one; revisit prompt wording after real usage, not before |
| `missingAmountPlannedExpenses` regression floods the dashboard | Scoped fix is part of this spec's Definition of Done, not a follow-up |
| One Claude call per sync adds latency | Batched (not per-event) and only for events without an amount; failure is non-fatal to the sync |
| Ticket-ID collision with `features/AGENTS.md` | Resolved above — this file uses C-13/C-14/A-23/A-24 |
