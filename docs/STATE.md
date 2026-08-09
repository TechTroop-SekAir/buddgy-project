# Buddgy — Client State

## Contents

| Section | What's in it |
|---|---|
| [Strategy](#strategy) | What owns which kind of state |
| [Server State (React Query)](#server-state-react-query) | Query keys, invalidation rules |
| [Local & Form State](#local--form-state) | useState vs context vs form libs |
| [Money at the Boundary](#money-at-the-boundary) | Where agorot↔shekel conversion happens |
| [Auth State](#auth-state) | Token storage, refresh, logout |

Related specs: [`API.md`](./API.md) · [`DESIGN.md`](./DESIGN.md) (form component patterns)

---

## Strategy

Per `.claude/commands/dev.md` § Frontend Patterns:

- **Server state** (anything that came from `/api/*`): React Query (TanStack Query)
- **Shared client-only state** (auth session, active month selector, toasts): React Context
- **Local UI state** (modal open/closed, form field values before submit): `useState`
- Prop drilling beyond 2 levels is a signal to move state up into context, not a pattern to accept

## Server State (React Query)

Query key convention: `[resource, userId, ...filters]`.

| Data | Key | Invalidated by |
|---|---|---|
| Envelopes for a month | `['envelopes', userId, month]` | envelope create/update/delete |
| Transactions | `['transactions', userId, month, envelopeId?]` | transaction create/delete, import confirm |
| Planned expenses | `['planned-expenses', userId, month]` | calendar sync, planned expense patch |
| Forecast | `['forecast', userId, month]` | any transaction, envelope, or planned-expense mutation for that month |
| Admin stats | `['admin-stats']` | polled, not mutation-invalidated |

**Rule:** any mutation that changes money must invalidate `forecast` for the affected month — it's easy to update the envelope list and forget the forecast is now stale.

## Local & Form State

- Forms use Mantine's form hook (`@mantine/form`) inside `components/ui/` wrappers — see [`DESIGN.md`](./DESIGN.md).
- Quick Entry is a two-stage local state machine: `idle → parsing → reviewing (editable) → saving → idle`. The `reviewing` stage holds the AI suggestion as editable form state — it is never treated as already-saved data.
- CSV import mirrors the same shape: `idle → uploading → previewing (editable mapping) → confirming → idle`.

## Money at the Boundary

- Every input and display component works in **shekels**. Every service function, query cache entry, and API payload works in **agorot**.
- Conversion happens only via the shared helpers referenced in `.claude/commands/design.md` (`shekelsToAgorot` / `agorotToShekels` / `formatShekels`) — never inline math in a component.
- React Query caches store the raw API shape (agorot) — components convert at render time, not at cache-write time, so the cache stays a faithful mirror of the server.

## Auth State

- JWT stored in memory (React Context) plus `localStorage` for persistence across reloads — never in a cookie without `httpOnly` (not applicable here since there's no server-rendered session).
- On 401 from any request, the client clears auth state and redirects to login — handled once, in the API client wrapper, not per-call.
- Logout clears both the context and `localStorage` synchronously before navigating away.
