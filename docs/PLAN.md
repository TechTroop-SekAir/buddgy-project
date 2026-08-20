# Buddgy — Delivery Plan

## Contents

| Section | What's in it |
|---|---|
| [Dates](#dates) | Start, freeze, demo prep |
| [Who Does What](#who-does-what) | The 3-way split |
| [The One Sequencing Rule](#the-one-sequencing-rule) | The only cross-person dependency that matters |
| [Darya — Client + UX](#darya--client--ux) | Her checklist, in order, with target days |
| [Matan — Server + DB](#matan--server--db) | His checklist, in order, with target days |
| [Ofek — Integrations + Deployment](#ofek--integrations--deployment) | His checklist, in order, with target days |
| [Definition of Done](#definition-of-done) | Before any item gets checked off |
| [Risks](#risks) | The likely ones, and what to do about them |
| [Technical Debt](#technical-debt) | Known gaps intentionally deferred, and why |

Related: [`PLAN-DETAILS.md`](./PLAN-DETAILS.md) has the day-by-day schedule, the demo script, and the requirement-traceability table — TA-facing detail you don't need day to day.

---

## Dates

- **Start:** Sunday, August 9
- **Feature freeze:** Wednesday, August 19, end of day — no new features merge after this
- **Bug fixes + demo prep:** Thursday, August 20

## Who Does What

| Person | Owns | Ticket prefix |
|---|---|---|
| **Darya** | Client + UX — routing, `components/ui/` adapters, pages, forms, state, responsive layout, empty/loading/error states | `A-` |
| **Matan** | Server + DB — migrations, models, auth, validation, CRUD, forecast, error middleware, admin endpoints | `B-` |
| **Ofek** | Integrations + Deployment — Claude, Google Calendar, CSV pipeline, Cloudinary/S3, Railway, CI | `C-` |

Ticket IDs keep their letter regardless of who's assigned — the letter is the layer, not the person. If you swap tracks, update this table only.

## The One Sequencing Rule

[`API.md`](./API.md) must be frozen by end of Day 1. Until Matan's real endpoints exist, Darya builds against a mock server matching that contract — they converge on Day 5 (ticket A-09). This is the one dependency that causes real rework if skipped; everything else below is either sequential within a person or noted inline.

---

## Darya — Client + UX

- [x] **A-01** Tokens + Mantine theme + Tailwind wired *(scaffolded — palette is a placeholder, finalize Day 1)*
- [x] **A-02** Routing skeleton + auth-gated routes *(scaffolded)*
- [x] **A-03** `components/ui/` adapters: Button, TextInput, NumberInput, Card, Modal *(scaffolded)*
- [x] **A-04** Auth pages (register/login) — *Day 3, against mock*
- [x] **A-05** Envelope dashboard (grid, status colors, empty state) — *Day 3, against mock*
- [x] **A-06** Envelope create/edit/delete forms — *Day 4. Re-verified: delete failures now surface an inline error instead of silently closing the confirm dialog, and Add/Edit were consolidated into one reusable `CategoryFormModal`. UI now labels this "Category" throughout (component dir `components/categories/`, `categoryService.js`) — the underlying DB table/model/`/api/envelopes` routes are unchanged and deliberately still called "envelope"; see `categoryService.js` for the mapping note and the naming-collision flag against the separate admin category catalog (B-06/B-08).*
- [x] **A-07** Transaction list + filters — *Day 4*
- [x] **A-08** Manual transaction form — *Day 5. Superseded the standalone `AddTransactionModal` with a single unified entry point: one "הוספת תנועה" button on both Dashboard and Transactions pages opens `QuickEntryModal`, which still tries the AI parse (`POST /api/transactions/parse`) first but falls back to local regex parsing (`utils/parseQuickEntryText.js`, no network dependency) when the AI call fails/times out, always landing on an editable review screen. Uncategorized parses default to an auto-created "הוצאות כלליות" category rather than blocking. Code-complete and builds clean; not yet exercised against a running backend in a browser — verify manually before demo.*
- [x] **A-09** Switch client from mock to real API — *Day 5, needs Matan's B-05. Verified: `authService`/`calendarService`/`importService`/`plannedExpenseService` all gate on `VITE_USE_MOCK_API`, `categoryService`/`transactionService` call the real API unconditionally, `api.js` correctly unwraps `{ data, error }` and handles 401. The one remaining gap (planned-expenses endpoints not implemented server-side) is closed by A-20.*
- [x] **A-10** Quick Entry UI (text → review → confirm) — *Day 6, needs Ofek's C-02*
- [ ] **A-19** i18n/RTL infra (Hebrew default) — *landed with A-10; react-i18next, `src/locales/`, `LocaleContext`, Mantine `DirectionProvider` all in place and every existing page/component uses it. Remaining: keep it current as new pages ship (see `client/CLAUDE.md` § i18n & RTL).*
- [x] **A-11** CSV import UI (upload → mapping → confirm) — *Day 7, needs Ofek's C-04*
- [x] **A-12** Calendar connect/sync UI + planned-expense assign — *Day 8, needs Ofek's C-06*
- [x] **A-13** Forecast banner + at-risk highlighting — *Day 9. Implemented: `client/src/components/categories/ForecastBanner.jsx` (banner), `CategoryCard.jsx` (at-risk border/badge), `MissingAmountPrompt.jsx`, `SummaryBar.jsx`, `client/src/utils/forecastStatus.js` + `categoryStatus.js` (pure helpers), wired into `DashboardPage.jsx` with forecast query invalidated on every money-relevant mutation. `client/src/services/forecastService.js` calls the real `/forecast` endpoint. i18n complete in `en.json`/`he.json`.*
- [x] **A-14** Admin panel — *Day 9, needs Matan's B-08*
- [x] **A-15** Month history navigation — *Day 10*
- [x] **A-16** Responsive pass across all pages — *Day 10*
- [x] **A-17** Empty/loading/error states audit — *Day 10*
- [ ] **A-18** Client E2E tests (Playwright) — *Day 11, feature freeze day*
- [x] **A-20** Server: `GET /api/planned-expenses?month=` + `PATCH /api/planned-expenses/:id` — *implemented (`server/routes/plannedExpenses.js`, `server/controllers/plannedExpensesController.js`, `server/services/plannedExpenseService.js`), tests in `server/__tests__/plannedExpenses.test.js`. A-12's client (`client/src/services/plannedExpenseService.js`) now hits the real endpoint when `VITE_USE_MOCK_API=false` — no UI rework needed.*

## Matan — Server + DB

*From B-10 onward, checked items get one line — what shipped + the primary file. Detail lives in git history and the specs, not here.*

- [x] **B-01** Migrations: `users`, `envelopes`, `transactions`, `planned_expenses`, `csv_imports` + indexes *(scaffolded)*
- [x] **B-02** Sequelize models + associations *(scaffolded)*
- [x] **B-04** Error middleware + response envelope helper *(scaffolded)*
- [x] **B-03** Auth: register/login/me, JWT middleware — *Day 2. Verified implemented: `server/routes/authRoutes.js` (`POST /register`, `POST /login`, `GET /me`), `server/controllers/authController.js`, JWT middleware in `server/middleware/auth.js` (`requireAuth`). Checkbox was stale relative to code.*
- [x] **B-05** Envelope + transaction CRUD endpoints — *Day 3. Verified implemented: `server/routes/envelopes.js` (GET/POST/PUT/PATCH/DELETE) and `server/routes/transactions.js` (GET/POST/PATCH/DELETE, plus `/parse`), both matching `docs/API.md` exactly. Checkbox was stale relative to code.*
- [x] **B-06** `categories` migration + model + endpoints (admin catalog) — *Day 4. Implemented: `server/migrations/20260809000600-create-categories.js`, `server/models/category.js`, `server/services/categoryService.js`, `server/routes/admin.js` + `adminCategories.js` (mounted at `/api/admin/categories`, gated by `requireAuth`+`requireAdmin`), tests in `server/__tests__/adminCategories.test.js`. Schema (`name_he`/`name_en`/`color`/`is_active`) documented in `docs/DATABASE.md` § categories and `docs/API.md` § Admin, since neither had it before. Standalone table, no FK — not to be confused with the client's "Category" (`envelopes`, see A-06). `server/seed.js` now also seeds an admin login (`admin@buddgy.com` / `password123`) and a default 10-row Hebrew catalog. `/api/admin/users` + `/api/admin/stats` remain B-08.*
- [x] **B-07** Forecast computation endpoint — *Day 5–8. Implemented: `server/services/forecastService.js` (aggregates envelopes/transactions/confirmed planned_expenses per `docs/ARCHITECTURE.md` § Forecast Computation), `server/controllers/forecastController.js`, `server/routes/forecast.js` (mounted at `/api/forecast`), tests in `server/__tests__/forecast.test.js`. `monthRange` deduplicated out of `transactionService.js`/`plannedExpenseService.js` into `server/utils/month.js`. `recommendation` ships as a structured object (`envelopeId`/`envelopeName`/`cutAgorot`), not a display sentence — the client is Hebrew-default (`client/src/i18n.js`), so wording lives client-side (`forecast.recommendation` key in `client/src/locales/*.json`); `docs/API.md` § Calendar & Forecast updated accordingly. Client-side `client/src/services/forecastService.js` added so A-13 has a real endpoint to call.*
- [x] **B-08** Admin endpoints (categories CRUD, user list/disable, stats) — *Day 9. Categories CRUD already shipped in B-06; this ticket implemented the remaining two: `GET`/`PATCH /api/admin/users` (`server/services/adminUserService.js`, `server/controllers/adminUsersController.js`, `server/routes/adminUsers.js`) and `GET /api/admin/stats` (`adminStatsService.js`/`adminStatsController.js`/`adminStats.js`), both mounted in `server/routes/admin.js`. Two migrations: `users.disabled` (`20260817000100-add-disabled-to-users.js`) and a new `ai_calls` table (`20260817000200-create-ai-calls.js`, `server/models/aiCall.js`) that `server/services/claudeService.js` now logs to on every real Anthropic call — including failures — so `aiCallCount` reflects actual API spend, not a proxy off `transactions`/`csv_imports`. `middleware/auth.js`'s `requireAuth` now re-fetches the user on every request and rejects `disabled` accounts, so a disable takes effect immediately rather than waiting out the JWT's 7-day TTL (`docs/SECURITY.md` § JWT Lifecycle) — `authService.login()`/`findUserById` got the same check. An admin can't disable their own account (`400`). Tests in `server/__tests__/adminUsers.test.js`; the `requireAuth` DB lookup required an additive `User` mock in every other suite that hits the app through `supertest`. Docs updated: `docs/API.md` § Admin/Error Catalog, `docs/DATABASE.md` § users/ai_calls, `docs/SECURITY.md` § JWT Lifecycle.*
- [x] **B-09** Server integration tests for all of the above — *Day 10. Real-Postgres layer for B-03/B-05/B-06/B-07/B-08 (auth, envelopes, transactions, admin categories, forecast, admin users/stats — B-10 owns the systematic cross-user-isolation matrix separately). New `server/tests/` (parallel to the DB-mocked `server/__tests__/`), split from it via `jest.config.js`/`jest.integration.config.js` + `npm run test:integration`, against a dedicated `buddgy_test` database (`scripts/create-test-db.sh`, `DATABASE_URL_TEST`) so `resetDb()`'s TRUNCATE-between-tests can never touch dev data. `server/tests/helpers/fixtures.js` provides real-row factories + real-JWT `authHeader()`. 75 tests across 6 suites, all passing against actual constraints (UNIQUE `name_en`, FK ownership checks, `ai_calls.user_id ON DELETE SET NULL`) — sanity-checked by deliberately breaking a query and confirming the mocked suite stayed green while this one correctly failed. CI (`.github/workflows/ci.yml`) runs it after the existing mocked suite, reusing the same `buddgy_ci` Postgres service via a new `DATABASE_URL_TEST` env entry.*
- [x] **B-10** Row-level access tests (cross-user isolation) — *Day 10. `server/tests/isolation.integration.test.js`; fixed a cross-user write in calendar sync (`google_event_id` UNIQUE is now per-user, migration `20260818000100`).*

## Ofek — Integrations + Deployment

- [x] **C-01** Railway project: client + server services + managed Postgres — *Day 1–2*
- [x] **C-02** Claude service: quick-entry parsing (`/api/transactions/parse`) — *Day 3–6, needs Matan's B-04*
- [x] **C-03** Claude service: CSV column-mapping detection — *Day 6*
- [x] **C-04** CSV pipeline: upload, storage, preview, confirm + `dedup_hash` — *Day 6–7, needs Matan's B-01*
- [x] **C-05** Google OAuth: connect flow + encrypted token storage — *Day 7, needs Matan's B-01/B-03*
- [x] **C-06** Calendar sync: fetch, amount extraction, upsert by `google_event_id` — *Day 8*
- [ ] **C-07** Storage service (Cloudinary/S3) for avatars + CSV files — *Day 9, CSV half landed early with C-04; avatar upload path remains*
- [x] **C-08** External-API failure handling (timeouts, rate limits, expired token) — *Day 10*
- [x] **C-09** CI pipeline: run tests on PR, mocked externals only — *Day 10*
- [ ] **C-10** Deploy promote + smoke checklist — *Day 11, needs Darya's A-16 and Matan's B-09*

---

## Definition of Done

Before checking a box:

- [ ] Matches [`API.md`](./API.md) / [`DATABASE.md`](./DATABASE.md) exactly — any deviation updates the spec in the same PR
- [ ] Tests pass (`.claude/commands/qa.md`), error/loading states handled, not just the happy path
- [ ] No `console.log`, no hardcoded IDs/URLs, responsive at [`DESIGN.md`](./DESIGN.md) breakpoints (client tickets)
- [ ] Reviewed by one of the other two before merging to `main`

## Risks

| Risk | Mitigation |
|---|---|
| Google OAuth consent-screen delays block calendar sync | Start C-05 no later than Day 7; use a test-user allowlist for the demo account |
| Railway/Postgres setup friction blocks everyone | C-01 starts Day 1, not deferred |
| CSV encoding issues (Hebrew bank exports, BOM, `,` vs `;`) silently drop rows | Explicit encoding-detection tests in C-04's Definition of Done |
| Scope creep past Day 11 | Freeze is non-negotiable — anything unfinished moves to [`OVERVIEW.md`](./OVERVIEW.md) § Extensions |

## Technical Debt

| Item | Notes |
|---|---|
| "Category" naming collision (client UI = `envelopes`) | A-06 deliberately labeled the client's envelope UI "Category" (`components/categories/`, `categoryService.js`, `categoryManagement.*`/`addCategoryModal.*`/`editCategoryModal.*` locale keys) — separate from the real, admin-managed `categories` table (B-06: global AI-classification catalog, `AdminCategoriesTable.jsx`, `services/adminService.js`). Confirmed confusing enough to fix. Scope, mapped exhaustively: ~25 client files (component/file renames — `CategoryCard.jsx`→`EnvelopeCard.jsx`, `categoryService.js`→`envelopeService.js`, `components/categories/`→`components/envelopes/` — plus props, the shared `['categories', user.id, month]` React Query cache key used across `DashboardPage`/`TransactionsPage`/`PlannedExpensesPage`/`ImportPage`/`QuickEntryModal`, locale keys+copy in both `en.json`/`he.json`, and 5 `e2e/*.spec.js` files that read those locale keys). **Leave alone:** the 4 admin-catalog files above (genuinely about the other `categories` table) and the server — already clean, no collision there (`server/routes/envelopes.js` vs `server/routes/adminCategories.js` are correctly separate). **Open decision for whoever picks this up:** whether to also rename the `--cat-N`/`cat-N-tint` Tailwind design tokens (`tokens.css`/`tailwind.config.js`/`theme.js`, tri-file rule per `client/CLAUDE.md`) — flagged as the highest-risk, lowest-value part of the rename, since Tailwind's JIT scanner requires literal class strings. **Two free wins to bundle in:** delete the dead top-level `"categories"` locale namespace (`en.json`/`he.json` — zero consumers, orphaned from a deleted `categoryLabel.js`), and fix the stale `categoryLabel.js` reference in `client/src/utils/categoryIcon.js`'s header comment (file doesn't exist). Deliberately postponed out of the Aug 20 gap-closing commit (onboarding backend + planned-expense/transaction link integrity) to keep that diff reviewable — do this as its own commit. |
