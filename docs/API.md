# Buddgy — API

## Contents

| Section | What's in it |
|---|---|
| [Conventions](#conventions) | Envelope format, auth, status codes |
| [Error Catalog](#error-catalog) | Standard error codes/messages |
| [Auth](#auth) | Register, login, me |
| [Envelopes](#envelopes) | CRUD |
| [Transactions](#transactions) | CRUD + AI parse |
| [CSV Import](#csv-import) | Preview + confirm |
| [Calendar & Forecast](#calendar--forecast) | Sync, planned expenses, forecast |
| [Admin](#admin) | Category catalog, users, stats |

Related specs: [`DATABASE.md`](./DATABASE.md) (backing tables) · [`SECURITY.md`](./SECURITY.md) (who can call what) · [`INTEGRATIONS.md`](./INTEGRATIONS.md) (what the AI/OAuth endpoints do internally)

---

## Conventions

- All routes prefixed `/api`.
- **Every response uses the standard envelope** (`CLAUDE.md` § API Design Rules):
  ```json
  { "data": ..., "error": null }
  { "data": null, "error": "message" }
  ```
  The shorthand response shapes below (e.g. `{ token, user }`) describe the shape of `data` — the actual HTTP body is `{ "data": { token, user }, "error": null }`. This note exists because the original spec draft showed unwrapped examples; treat this file as the corrected version.
- Status codes are semantically correct — a request that fails never returns `200`.
- Auth: `Authorization: Bearer <jwt>`. Routes marked 🔒 require a valid token; 🔒admin requires `role = 'admin'`.
- Input validation happens in middleware, before the controller (`CLAUDE.md` § API Design Rules).

## Error Catalog

| HTTP | `error` message | When |
|---|---|---|
| 400 | `"validation failed: <field>"` | Missing/malformed input |
| 400 | `"cannot disable your own account"` | `PATCH /api/admin/users/:id` — an admin may not disable the account they're currently authenticated as |
| 401 | `"unauthorized"` | Missing/invalid/expired JWT, or the token belongs to a disabled account (ticket B-08 — checked on every request, not just at login) |
| 403 | `"forbidden"` | Valid token, wrong role or wrong owner |
| 404 | `"not found"` | Resource doesn't exist or isn't owned by the caller |
| 409 | `"duplicate"` | Unique constraint hit outside the expected dedup path |
| 422 | `"unprocessable: ai parse failed"` | Claude couldn't extract a usable structure |
| 502 | `"upstream unavailable: <service>"` | Google or Anthropic timed out / errored — see `.claude/commands/dev.md` § Buddgy Domain Rules |

## Auth

```
POST   /api/auth/register     { email, password, full_name? }  → { token, user }
POST   /api/auth/login        { email, password }               → { token, user }
GET    /api/auth/me       🔒                                    → { user }
```

`full_name` is optional (nullable column) — the client doesn't collect it yet. `user` also carries a derived `connected` boolean (`Boolean(google_refresh_token)`) — never the token itself — so the client can show Connect vs Sync now (ticket A-12).

## Envelopes

```
GET          /api/envelopes?month=2026-08                🔒  → [ envelope ]
POST         /api/envelopes                              🔒  → envelope
PUT | PATCH  /api/envelopes/:id                          🔒  → envelope   (partial update: name/budget/color)
DELETE       /api/envelopes/:id                          🔒  → { id }
```

`month` accepts either `2026-08` or `2026-08-01` (client/src/utils/month.js's `getCurrentMonth()`
sends the latter) — both normalize to the first-of-month `DATEONLY` value. The spec says `PUT`;
the shipped client (`envelopeService.js`) calls `PATCH`. Both are accepted, same handler, body is
a partial update either way.

Envelope `data` carries a **derived, response-only `spent_agorot`** field — summed from
`transactions` at read time, not a DB column (see [`DATABASE.md`](./DATABASE.md) § envelopes).
Always present, `0` (never `null`) when the envelope has no transactions yet.

All scoped to the caller's `user_id` — see [`SECURITY.md`](./SECURITY.md) § Row-Level Access.

## Transactions

```
GET    /api/transactions?month=2026-08&envelopeId=3  🔒  → [ transaction ]
POST   /api/transactions                             🔒  → transaction   (manual creation)
PATCH  /api/transactions/:id                          🔒  → transaction   (partial update — e.g. assign an unassigned CSV row to an envelope)
DELETE /api/transactions/:id                          🔒  → { id }
```

`envelope_id` (create and update) must belong to the caller or be `null` — a foreign or
nonexistent id is `400 "validation failed: envelope_id"`, not silently accepted.

### AI Quick Entry

```
POST /api/transactions/parse   🔒
```

This endpoint **only parses — it never writes to `transactions`.** The client shows the result for confirmation/edit, then calls `POST /api/transactions` to actually save. See [`INTEGRATIONS.md`](./INTEGRATIONS.md) § AI Quick Entry for the prompt and failure modes.

Request:
```json
{ "text": "coffee and a pastry in Ramat Gan, 34 shekels" }
```

Response `data`:
```json
{
  "amount_agorot": 3400,
  "category": "Cafes & Restaurants",
  "suggested_envelope_id": 3,
  "description": "Coffee and pastry",
  "transaction_date": "2026-08-08",
  "confidence": 0.93
}
```

## CSV Import

```
POST /api/imports/preview   🔒  (multipart/form-data, field name "file", max 10MB)
```

Response `data`:
```json
{
  "importId": 12,
  "detectedMapping": { "date": "Transaction Date", "amount": "Charge Amount",
                       "description": "Merchant" },
  "previewRows": [ { "transaction_date": "2026-08-01", "amount_agorot": 12990,
                     "description": "Shufersal Deal" } ]
}
```

`detectedMapping` values are `null` where Claude found no matching column, or where Claude was unreachable entirely — the file is still uploaded and `importId` is still returned either way (upload happens before the Claude call, not after), so this endpoint never fails just because Claude is down. The client must let the user pick manually whenever any value is `null`. Never persists any rows.

```
POST /api/imports/:id/confirm   🔒   body: { "mapping": { "date": "...", "amount": "...", "description": "..." | null } }
                                      → { imported: 47, duplicatesSkipped: 3 }
```

`mapping` keys are the source-file column names to use, taken from the caller (pre-filled by `detectedMapping`, editable). `date` and `amount` are required. Rows are inserted with `envelope_id: null`, `source: 'csv'`. `duplicatesSkipped` counts rows whose `dedup_hash` already existed — see [`DATABASE.md`](./DATABASE.md) § Idempotency.

## Calendar & Forecast

```
GET    /api/calendar/connect      🔒  → { url }   (Google consent screen URL; client redirects to it)
GET    /api/calendar/callback         unauthed — Google redirects here; identity comes from the
                                       signed `state` param minted by /connect. Redirects the
                                       browser to `${CLIENT_URL}/settings?calendar=connected|error`,
                                       never returns JSON.
POST   /api/calendar/sync         🔒  → { newEvents: 4 }
DELETE /api/calendar/disconnect   🔒  → { connected: false }   (planned_expenses rows are kept)
GET    /api/planned-expenses?month=2026-08   🔒  → [ planned_expense ]
POST   /api/planned-expenses      🔒  → planned_expense   (manual one-off entry; source is always 'manual', google_event_id always null)
PATCH  /api/planned-expenses/:id  🔒  → planned_expense   (confirm / assign to envelope)
DELETE /api/planned-expenses/:id  🔒  → { id }
GET    /api/forecast?month=2026-08   🔒  → forecast
```

`/connect` returns a JSON `{ url }` pointing at Google's consent screen — the **client** performs the redirect (`window.location.href = url`); the server itself never redirects on this route (`docs/INTEGRATIONS.md` previously said otherwise — corrected).

`/sync` error strings are calendar-specific, not the generic Error Catalog below: `"Google Calendar is not connected."` (401), `"Google Calendar access was revoked. Please reconnect."` (401), `"Google Calendar is rate-limited. Try again shortly."` (429), `"Google Calendar is temporarily unavailable. Try again shortly."` (502). The client must not treat every 401 here as a session expiry — only the literal `"unauthorized"` message means "log out."

`planned_expense` shape (ticket A-20):
```json
{ "id": 3, "user_id": 1, "envelope_id": 10, "title": "Car service", "amount_agorot": 45000,
  "due_date": "2026-08-20", "google_event_id": "evt_3", "is_confirmed": true, "source": "calendar" }
```
`GET` filters by `due_date` falling within the given month. `POST` accepts `envelope_id` (nullable, must belong to the caller), `title`, `amount_agorot`, `due_date` — `google_event_id`, `source`, and `user_id` are server-assigned (`google_event_id: null`, `source: 'manual'`), never client-writable. `PATCH` accepts a partial body with any of `envelope_id` (nullable — must belong to the caller), `title`, `amount_agorot`, `due_date`, `is_confirmed`; `google_event_id` and `source` are never client-writable via either route. `DELETE` permanently removes the row — but deleting a `source: 'calendar'` row does not stop it from coming back: `POST /api/calendar/sync` UPSERTs on `google_event_id` (`server/services/calendarSyncService.js`'s `findOrCreate`) with no concept of "user intentionally deleted this," so the next sync silently recreates it if the underlying Google Calendar event is still live. Only `source: 'manual'` deletions are permanent. `amount_agorot` **can** be `null` or `0` ("missing amount") at rest — the DB column has no `NOT NULL` constraint — but neither current write path actually produces that today: calendar sync skips any event it can't parse an amount from rather than inserting one with a missing amount (`server/services/calendarSyncService.js`), and `PATCH`'s validation (`server/routes/plannedExpenses.js`) requires `amount_agorot` to be a positive integer whenever it's included, so a client can fill in a missing amount but can't currently clear one back to null via this route. In practice a missing amount is only reachable today through the client's mock calendar path (`VITE_USE_MOCK_CALENDAR=true`, the committed local-dev default), which writes directly to a local mock store with no such validation — worth a follow-up once the real endpoint is the default, if the product still wants a genuine "unknown amount" state representable server-side. The client (ticket A-13) treats it as a real case regardless of source, surfacing an actionable prompt rather than silently formatting a missing amount as ₪0.00.

Forecast response `data` (ticket B-07):
```json
{ "projectedBalanceAgorot": -48000, "atRiskEnvelopes": [3],
  "recommendation": { "envelopeId": 3, "envelopeName": "Entertainment", "cutAgorot": 50000 },
  "totalActualSpentAgorot": 361800, "totalPlannedExpensesAgorot": 112000,
  "totalEndOfMonthSpendAgorot": 473800, "missingAmountPlannedExpenses": [] }
```
`projectedBalanceAgorot` = sum of `envelopes.monthly_budget_agorot` for the month, minus recorded `transactions.amount_agorot` (including unassigned rows), minus `planned_expenses.amount_agorot` where `is_confirmed = true` and `due_date` falls in the month — see `docs/ARCHITECTURE.md` § Forecast Computation for the full breakdown. `atRiskEnvelopes` are envelope ids whose own projection (same math, scoped to that envelope's transactions/planned expenses for the month) goes negative. `totalActualSpentAgorot`/`totalPlannedExpensesAgorot` are the same two summed terms `projectedBalanceAgorot` is derived from, surfaced individually so the client (`SummaryBar.jsx`) can show them as separate line items rather than re-deriving them; `totalEndOfMonthSpendAgorot` is their sum. `missingAmountPlannedExpenses` is that month's planned expenses (confirmed or not) whose `amount_agorot` is `null` or `0`, in the same shape as the `planned_expense` objects above — consumed by `MissingAmountPrompt.jsx` on the Dashboard.

`recommendation` is a **structured object, not a display sentence** — the client defaults to Hebrew (`client/src/i18n.js`), so the server can't hand back a finished English string; it names the envelope with the most headroom to absorb the shortfall (`envelopeId`, `envelopeName`, `cutAgorot`) and the client interpolates the translated wording (`forecast.recommendation` in `client/src/locales/*.json`), same pattern as `client/src/utils/errorMessages.js`. It's `null` when the projection isn't negative, or when no envelope has positive headroom to recommend cutting from.

`totalActualSpentAgorot`, `totalPlannedExpensesAgorot`, `totalEndOfMonthSpendAgorot`, and `missingAmountPlannedExpenses` are all computed server-side, in the same `server/services/forecastService.js#get()` call as `projectedBalanceAgorot` — `client/src/services/forecastService.js` passes the response straight through with no client-side re-derivation. (An earlier version of this endpoint returned only `projectedBalanceAgorot`/`atRiskEnvelopes`/`recommendation`, with the client separately re-fetching envelopes/planned-expenses to derive the rest — that split let the two computations drift out of sync and was removed in favor of one implementation of the math.) `totalPlannedExpensesAgorot` sums only confirmed (`is_confirmed: true`) planned expenses for the month; `totalEndOfMonthSpendAgorot = totalActualSpentAgorot + totalPlannedExpensesAgorot`, and `projectedBalanceAgorot = totalBudget − totalEndOfMonthSpendAgorot` (the "Remaining Total Budget" the client shows — no separate field, it's the same number). `missingAmountPlannedExpenses` lists that month's planned expenses (confirmed or not) with a null/0 `amount_agorot`, for the client's actionable prompt; entries are excluded from `totalPlannedExpensesAgorot` until filled in via `PATCH`.

`atRiskEnvelopes` must resolve to `[]` (not error) when the user has zero envelopes or zero planned expenses for the month — see `.claude/commands/qa.md` § Buddgy Critical Test Cases. The same degrade-gracefully rule applies to every total field (all `0`) and `missingAmountPlannedExpenses` (`[]`).

## Admin

```
GET    /api/admin/categories       🔒admin  → [ category ]
POST   /api/admin/categories       🔒admin  → category
PUT    /api/admin/categories/:id   🔒admin  → category
DELETE /api/admin/categories/:id   🔒admin  → { id }

GET    /api/admin/users            🔒admin  → [ user ]
PATCH  /api/admin/users/:id        🔒admin  → { id, disabled }

GET    /api/admin/stats            🔒admin  → { userCount, transactionCount, aiCallCount }
```

`category` object:
```json
{ "id": 1, "name_he": "מזון", "name_en": "Food", "color": "#f97316",
  "is_active": true, "created_at": "2026-08-16T13:44:49.479Z" }
```
`POST` body: `name_he`, `name_en` required; `color`, `is_active` (default `true`) optional. `PUT` accepts a partial body of any of `name_he`, `name_en`, `color`, `is_active` — an empty body is `400`. A duplicate `name_en` is `409 duplicate`. `DELETE` is a hard delete; retiring a category without deleting it is `PUT` with `is_active: false`.

`categories` is a standalone global catalog (see [`DATABASE.md`](./DATABASE.md) § categories) — it feeds the AI classification engine's taxonomy and has no relation to the client UI's "Category" (which is `envelopes`; see `client/src/services/categoryService.js`).

`user` object (ticket B-08):
```json
{ "id": 2, "email": "test@buddgy.com", "full_name": "Dev User", "avatar_url": null,
  "role": "user", "disabled": false, "created_at": "2026-08-09T00:00:00.000Z" }
```
Never includes `password_hash` or `google_refresh_token` (`docs/SECURITY.md` § Secrets). `PATCH` body is `{ "disabled": boolean }`; an admin disabling their own account is `400 cannot disable your own account` — the last admin can't lock themselves out of the panel, though disabling *other* admins is allowed. Disabling takes effect immediately: `middleware/auth.js`'s `requireAuth` checks `disabled` on every request (not just at login), so an existing token is revoked the moment an admin flips it, rather than waiting out the JWT's 7-day TTL — see `docs/SECURITY.md` § JWT Lifecycle.

`stats` response (ticket B-08): `userCount` and `transactionCount` are row counts. `aiCallCount` counts every real Anthropic API call — including ones the user later abandoned (`POST /api/transactions/parse` never persists) or that failed — from a dedicated `ai_calls` table logged inside `server/services/claudeService.js`, since those still cost API spend. It is **not** a proxy off `transactions`/`csv_imports`, which would undercount.
