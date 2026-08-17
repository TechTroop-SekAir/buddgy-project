# Buddgy — Testing

## Contents

| Section | What's in it |
|---|---|
| [Strategy](#strategy) | Layers and where the detail lives |
| [Coverage Targets](#coverage-targets) | What must be tested before a feature is "done" |
| [Buddgy-Critical Cases](#buddgy-critical-cases) | The domain-specific cases that must never be skipped |
| [Mocking Policy](#mocking-policy) | External services in tests |

Related: `.claude/commands/qa.md` (full process — this file is the spec, that file is the how-to-run-a-QA-session guide; don't duplicate between them)

---

## Strategy

Three layers, detailed in `.claude/commands/qa.md` § Test Layers:
- **Unit** (Jest) — pure functions and service logic, mocked externals. `server/__tests__/*.test.js`, run via `npm test`.
- **Integration** (Jest + Supertest) — API endpoints against a real test DB. `server/tests/*.integration.test.js` (ticket B-09), run via `npm run test:integration`, which points `DATABASE_URL` at `DATABASE_URL_TEST` (a dedicated `buddgy_test` database — see `scripts/create-test-db.sh` for local one-time setup; CI reuses its existing `buddgy_ci` service). `server/tests/helpers/db.js`'s `resetDb()` truncates every table between tests and refuses to run against a database whose name doesn't end in `_test`, as a second guard against ever touching dev data.
- **E2E** (Playwright) — full user flows through the browser

## Coverage Targets

Before a feature is considered done (mirrors `.claude/commands/qa.md` § QA Handoff Checklist):
- Unit tests for all service/utility logic, especially money math and dedup-hash generation
- Integration tests for every endpoint in [`API.md`](./API.md): happy path, validation failure, auth failure, cross-user access attempt
- One E2E test per primary flow (see below)

## Buddgy-Critical Cases

These are specific to this domain and must exist regardless of what else is in flight — full list and rationale in `.claude/commands/qa.md` § Buddgy Critical Test Cases:

- No float drift in agorot math
- CSV re-import is a no-op for already-imported rows (`dedup_hash`)
- Calendar re-sync creates no duplicate `planned_expenses` (`google_event_id`)
- Unassigned transactions (`envelope_id = NULL`) don't break forecasting
- Forecast math handles zero envelopes / zero planned expenses without throwing
- Cross-user data isolation on every resource type

Primary E2E flows: auth, envelope CRUD, quick-entry → confirm → save, CSV upload → mapping → import, calendar connect → sync → confirm.

## Mocking Policy

Google Calendar and Anthropic Claude are **always mocked** in unit, integration, and CI runs — never called live. Stub both success and failure responses (timeout, rate limit, malformed AI output) so the failure paths in [`INTEGRATIONS.md`](./INTEGRATIONS.md) § Failure Handling are actually exercised, not just implemented and forgotten.
