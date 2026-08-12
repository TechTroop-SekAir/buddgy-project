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
- [x] **A-06** Envelope create/edit/delete forms — *Day 4*
- [x] **A-07** Transaction list + filters — *Day 4*
- [ ] **A-08** Manual transaction form — *Day 5 (transactionService.create + mock landed with A-10; needs its own entry form/UI)*
- [ ] **A-09** Switch client from mock to real API — *Day 5, needs Matan's B-05*
- [x] **A-10** Quick Entry UI (text → review → confirm) — *Day 6, needs Ofek's C-02*
- [ ] **A-19** i18n/RTL infra (Hebrew default) — *landed with A-10; react-i18next, `src/locales/`, `LocaleContext`, Mantine `DirectionProvider` all in place and every existing page/component uses it. Remaining: keep it current as new pages ship (see `client/CLAUDE.md` § i18n & RTL).*
- [ ] **A-11** CSV import UI (upload → mapping → confirm) — *Day 7, needs Ofek's C-04*
- [ ] **A-12** Calendar connect/sync UI + planned-expense assign — *Day 8, needs Ofek's C-06*
- [ ] **A-13** Forecast banner + at-risk highlighting — *Day 9, needs Matan's B-07*
- [ ] **A-14** Admin panel — *Day 9, needs Matan's B-08*
- [ ] **A-15** Month history navigation — *Day 10*
- [ ] **A-16** Responsive pass across all pages — *Day 10*
- [ ] **A-17** Empty/loading/error states audit — *Day 10*
- [ ] **A-18** Client E2E tests (Playwright) — *Day 11, feature freeze day*
- [x] **A-19** i18n & RTL infrastructure + retrofit existing pages — *Day 4*

## Matan — Server + DB

- [x] **B-01** Migrations: `users`, `envelopes`, `transactions`, `planned_expenses`, `csv_imports` + indexes *(scaffolded)*
- [x] **B-02** Sequelize models + associations *(scaffolded)*
- [x] **B-04** Error middleware + response envelope helper *(scaffolded)*
- [ ] **B-03** Auth: register/login/me, JWT middleware — *Day 2*
- [ ] **B-05** Envelope + transaction CRUD endpoints — *Day 3*
- [ ] **B-06** `categories` migration + model + endpoints (admin catalog) — *Day 4*
- [ ] **B-07** Forecast computation endpoint — *Day 5–8*
- [ ] **B-08** Admin endpoints (categories CRUD, user list/disable, stats) — *Day 9*
- [ ] **B-09** Server integration tests for all of the above — *Day 10*
- [ ] **B-10** Row-level access tests (cross-user isolation) — *Day 10*

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
| Mock transaction descriptions are English-only (`DEFAULT_TRANSACTIONS` in `mockTransactionService.js` — "Rent payment", "Electric bill", etc.) | Translate to Hebrew to match the rest of the now Hebrew-default UI (`A-19`) |
