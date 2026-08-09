# Buddgy — External Integrations

## Contents

| Section | What's in it |
|---|---|
| [Anthropic Claude API](#anthropic-claude-api) | Quick entry parsing, CSV mapping detection |
| [Google Calendar API](#google-calendar-api) | OAuth flow, event sync, amount extraction |
| [Cloudinary / AWS S3](#cloudinary--aws-s3) | File and image storage |
| [Failure Handling](#failure-handling) | What every integration must do when the upstream is down |

Related specs: [`ARCHITECTURE.md`](./ARCHITECTURE.md) (sequence diagrams) · [`API.md`](./API.md) · [`SECURITY.md`](./SECURITY.md)

---

## Anthropic Claude API

Two call sites, both in `server/services/claudeService.js` — never called directly from a controller.

**1. Quick Entry parsing** (`POST /api/transactions/parse`)
- Input: free-form text (e.g. `"coffee and a pastry in Ramat Gan, 34 shekels"`)
- Output: structured JSON — `amount_agorot`, `category`, `suggested_envelope_id`, `description`, `transaction_date`, `confidence`
- Use Structured Output / tool-use to force valid JSON — never regex-parse a free-text completion
- `confidence` is surfaced to the user; the UI should visually de-emphasize low-confidence suggestions rather than silently accepting them
- **Never persisted directly** — see [`ARCHITECTURE.md`](./ARCHITECTURE.md) § Input Channel: AI Quick Entry

**2. CSV column-mapping detection** (`POST /api/imports/preview`)
- Input: the CSV's header row (+ a few sample rows)
- Output: a best-guess mapping of source columns → `{ date, amount, description }`
- Always shown to the user as an editable mapping before `POST /api/imports/:id/confirm` — same confirm-before-write rule as Quick Entry

## Google Calendar API

OAuth2, `server/services/googleCalendarService.js`.

- **Connect:** `GET /api/calendar/connect` redirects to Google's consent screen; on callback, exchange the code for a refresh token and store it **encrypted** on `users.google_refresh_token` (see [`SECURITY.md`](./SECURITY.md))
- **Sync:** `POST /api/calendar/sync` fetches upcoming events, extracts an amount from each event title (regex for a currency pattern, falling back to skipping the event if none is found), and `UPSERT`s into `planned_expenses` keyed on `google_event_id`
- **Scope:** request the minimum Calendar scope needed (read-only) — never request write access to the user's calendar
- **Disconnect:** clears `google_refresh_token`; existing `planned_expenses` rows are kept (historical record) but no further sync occurs

## Cloudinary / AWS S3

`server/services/storageService.js` — a single interface regardless of which provider is chosen, so the choice stays swappable (mirrors the `components/ui/` pattern in [`DESIGN.md`](./DESIGN.md)).

- Two upload types: profile pictures (`users.avatar_url`) and CSV/Excel files (`csv_imports.file_url`)
- The DB only ever stores the resulting URL — binary content never touches PostgreSQL
- Validate file type and size **before** uploading, not after — reject a 50 MB "CSV" at the API boundary

## Failure Handling

Every integration call must have an explicit failure path — this is checked in code review (`.claude/commands/dev.md` § Code Review Checklist):

| Failure | Handling |
|---|---|
| Claude timeout / rate limit | Return `422` with a clear message; client offers manual entry as a fallback |
| Claude returns malformed/incomplete JSON | Same as above — never pass a partial object through to the confirmation UI |
| Google token expired/revoked | Return `401`-equivalent for that specific action; client prompts to reconnect, doesn't silently fail the whole dashboard |
| Google API rate limit | Back off and surface "sync will retry later" rather than a raw error |
| Storage upload failure | Do not create the DB row referencing the file until the upload succeeds |

All three integrations are **mocked in tests** — see `.claude/commands/qa.md`. Never call a live external API from CI.
