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
| 401 | `"unauthorized"` | Missing/invalid/expired JWT |
| 403 | `"forbidden"` | Valid token, wrong role or wrong owner |
| 404 | `"not found"` | Resource doesn't exist or isn't owned by the caller |
| 409 | `"duplicate"` | Unique constraint hit outside the expected dedup path |
| 422 | `"unprocessable: ai parse failed"` | Claude couldn't extract a usable structure |
| 502 | `"upstream unavailable: <service>"` | Google or Anthropic timed out / errored — see `.claude/commands/dev.md` § Buddgy Domain Rules |

## Auth

```
POST   /api/auth/register     → { token, user }
POST   /api/auth/login        → { token, user }
GET    /api/auth/me       🔒  → { user }
```

## Envelopes

```
GET    /api/envelopes?month=2026-08                🔒  → [ envelope ]
POST   /api/envelopes                              🔒  → envelope
PUT    /api/envelopes/:id                          🔒  → envelope   (update budget/name/color)
DELETE /api/envelopes/:id                          🔒  → { id }
```

All scoped to the caller's `user_id` — see [`SECURITY.md`](./SECURITY.md) § Row-Level Access.

## Transactions

```
GET    /api/transactions?month=2026-08&envelopeId=3  🔒  → [ transaction ]
POST   /api/transactions                             🔒  → transaction   (manual creation)
DELETE /api/transactions/:id                          🔒  → { id }
```

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
POST /api/imports/preview   🔒  (multipart/form-data)
```

Response `data`:
```json
{
  "importId": 12,
  "detectedMapping": { "date": "Transaction Date", "amount": "Charge Amount",
                       "description": "Merchant" },
  "previewRows": [ { "date": "2026-08-01", "amount_agorot": 12990,
                     "description": "Shufersal Deal" } ]
}
```

```
POST /api/imports/:id/confirm   🔒   → { imported: 47, duplicatesSkipped: 3 }
```

`duplicatesSkipped` counts rows whose `dedup_hash` already existed — see [`DATABASE.md`](./DATABASE.md) § Idempotency.

## Calendar & Forecast

```
GET    /api/calendar/connect      🔒  → { url }   (Google consent screen URL; client redirects to it)
GET    /api/calendar/callback         unauthed — Google redirects here; identity comes from the
                                       signed `state` param minted by /connect. Redirects the
                                       browser to CLIENT_URL, never returns JSON.
POST   /api/calendar/sync         🔒  → { newEvents: 4 }
DELETE /api/calendar/disconnect   🔒  → { connected: false }   (planned_expenses rows are kept)
GET    /api/planned-expenses?month=2026-08   🔒  → [ planned_expense ]
PATCH  /api/planned-expenses/:id  🔒  → planned_expense   (confirm / assign to envelope)
GET    /api/forecast?month=2026-08   🔒
```

Forecast response `data`:
```json
{ "projectedBalanceAgorot": -48000, "atRiskEnvelopes": [3],
  "recommendation": "Cut 500 ILS from the Entertainment envelope" }
```

`atRiskEnvelopes` must resolve to `[]` (not error) when the user has zero envelopes or zero planned expenses for the month — see `.claude/commands/qa.md` § Buddgy Critical Test Cases.

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

`categories` backs a table not yet listed in [`DATABASE.md`](./DATABASE.md) — add it there in the same PR that implements this endpoint (Track B).
