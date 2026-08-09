# Buddgy — Delivery Plan

## Contents

| Section | What's in it |
|---|---|
| [Timeline](#timeline) | Real calendar dates, freeze point |
| [Tracks](#tracks) | The 3-way split of concerns |
| [Critical Path](#critical-path) | What must happen first, and why |
| [Definition of Done](#definition-of-done) | Per-ticket checklist |
| [Board](#board) | All tickets by track, with blockers |
| [Day-by-Day Schedule](#day-by-day-schedule) | What's active each day |
| [Risk Register](#risk-register) | Known risks + mitigations |
| [Demo Script Outline](#demo-script-outline) | 7-minute slot, mapped to features |
| [Requirement Traceability](#requirement-traceability) | Every bootcamp requirement → ticket |

Related specs: all of `docs/` — this is the file that sequences building everything else describes.

---

## Timeline

Per `final_project.md` Step 5: development starts **Sunday, August 9**, feature close is **Wednesday, August 19 EOD**, bug fixes + demo prep is **Thursday, August 20**. That's 11 working days plus 1 demo-prep day — this plan uses those real dates, not a generic Day 1–14.

## Tracks

Generic labels — the three of you assign yourselves to a track at kickoff (Day 1 standup). Each track owns a layer, not a person:

- **Track A — Client + UX:** routing, `components/ui/` Mantine adapters, pages, forms, state management, responsive layout, empty/loading/error states
- **Track B — Server + DB:** migrations, models, auth, validation, envelope/transaction CRUD, forecast calculation, error middleware, admin endpoints
- **Track C — Integrations + Deployment:** Claude parsing, Google OAuth + calendar sync, CSV pipeline, Cloudinary/S3, Railway, CI

## Critical Path

**The API contract must be frozen on Day 1–2, before either Track A or Track C build against it.** This is the single most important sequencing decision here: Track A is otherwise blocked on Track B's real implementation, and building the client against a moving contract is the single biggest source of wasted rework in a 3-person, 11-day project.

Mitigation: once [`API.md`](./API.md) is locked, Track A builds against a mock server (e.g. `msw`) matching that contract while Track B implements it for real. They converge by Day 5.

Dependency chain: `migrations → models → API contract → client services → pages`.

## Definition of Done

Every ticket, before being marked complete:

- [ ] Matches [`API.md`](./API.md) / [`DATABASE.md`](./DATABASE.md) exactly — any deviation gets the spec updated in the same PR, not silently
- [ ] Unit + integration tests pass (`.claude/commands/qa.md`)
- [ ] No `console.log`, no hardcoded IDs/URLs (`CLAUDE.md` § Non-Negotiables)
- [ ] Error and loading states handled, not just the happy path
- [ ] Responsive at the breakpoints in [`DESIGN.md`](./DESIGN.md) (client tickets only)
- [ ] Reviewed by at least one other track before merging to `main`

## Board

Ticket IDs are stable references — link to them from commits/PRs (`A-01: ...`).

**Scaffolded already** (Day 1 infra pass, before kickoff): A-01 (tokens + theme wired, palette provisional), A-02 (routing skeleton), A-03 (`components/ui/` adapters), B-01 (all 5 migrations + indexes), B-02 (models + associations), B-04 (error middleware + `respond.js` + `asyncHandler.js`). Each still needs its owning track to review, harden, and finalize — e.g. A-01's palette is a placeholder, B-03 auth wiring is not yet connected to real routes.

### Track A — Client + UX

| ID | Ticket | Blocked by |
|---|---|---|
| A-01 | Tokens + Mantine theme + Tailwind config wired together | — |
| A-02 | Routing skeleton (React Router) + auth-gated routes | — |
| A-03 | `components/ui/` adapters: Button, TextInput, NumberInput, Card, Modal | A-01 |
| A-04 | Auth pages (register/login) against mocked API | A-02, A-03 |
| A-05 | Envelope dashboard (grid, status colors, empty state) against mocked API | A-03 |
| A-06 | Envelope create/edit/delete forms | A-05 |
| A-07 | Transaction list + filters (envelope/date/amount) | A-05 |
| A-08 | Manual transaction form | A-06 |
| A-09 | Switch client from mocked API to real Track B endpoints | B-05, A-04–A-08 |
| A-10 | Quick Entry UI (text input → review/edit → confirm) | C-02, A-09 |
| A-11 | CSV import UI (upload → mapping review → confirm) | C-04, A-09 |
| A-12 | Calendar connect/sync UI + planned-expense assign/approve | C-06, A-09 |
| A-13 | Forecast banner + at-risk envelope highlighting | B-07, A-09 |
| A-14 | Admin panel (categories, users, stats) | B-08, A-09 |
| A-15 | Month history navigation | A-09 |
| A-16 | Responsive pass across all pages | A-05–A-14 |
| A-17 | Empty/loading/error states audit across all pages | A-16 |
| A-18 | Client E2E tests (Playwright) for primary flows | A-10, A-11, A-12 |

### Track B — Server + DB

| ID | Ticket | Blocked by |
|---|---|---|
| B-01 | Migrations: `users`, `envelopes`, `transactions`, `planned_expenses`, `csv_imports` + indexes | — |
| B-02 | Sequelize models + associations | B-01 |
| B-03 | Auth: register/login/me, JWT middleware | B-02 |
| B-04 | Error middleware + response envelope helper | — |
| B-05 | Envelope + transaction CRUD endpoints | B-02, B-03, B-04 |
| B-06 | Migration + model + endpoints for `categories` (admin catalog) | B-01 |
| B-07 | Forecast computation endpoint | B-05 |
| B-08 | Admin endpoints (categories CRUD, user list/disable, stats) | B-03, B-06 |
| B-09 | Server integration tests for all of the above | B-05, B-07, B-08 |
| B-10 | Row-level access tests (cross-user isolation) | B-05 |

### Track C — Integrations + Deployment

| ID | Ticket | Blocked by |
|---|---|---|
| C-01 | Railway project setup: client + server services + managed Postgres | — |
| C-02 | Claude service: quick-entry parsing endpoint (`/api/transactions/parse`) | B-04 |
| C-03 | Claude service: CSV column-mapping detection | B-04 |
| C-04 | CSV pipeline: upload, storage, preview, confirm + `dedup_hash` | C-03, B-01 |
| C-05 | Google OAuth: connect flow + encrypted token storage | B-01, B-03 |
| C-06 | Calendar sync: fetch, amount extraction, `UPSERT` by `google_event_id` | C-05 |
| C-07 | Storage service (Cloudinary/S3) for profile pictures + CSV files | C-01 |
| C-08 | External-API failure handling (timeouts, rate limits, expired token) for C-02/C-04/C-06 | C-02, C-04, C-06 |
| C-09 | CI pipeline: run tests on PR, mocked externals only | C-01 |
| C-10 | Deploy promote process + smoke checklist run before demo | C-01, A-16, B-09 |

## Day-by-Day Schedule

| Day | Date | Focus |
|---|---|---|
| 1 | Sun Aug 9 | Kickoff, track assignment, A-01/A-02, B-01/B-04, C-01. **API contract in `API.md` reviewed and frozen by end of day.** |
| 2 | Mon Aug 10 | A-03, B-02/B-03, C-01 finishes (empty app deployed both environments) |
| 3 | Tue Aug 11 | A-04/A-05 (against mock), B-05, C-02 starts |
| 4 | Wed Aug 12 | A-06/A-07, B-06, C-02 continues |
| 5 | Thu Aug 13 | A-08, A-09 (client switches to real API), B-07 starts |
| 6 | Fri Aug 14 | A-10 + C-02 converge (Quick Entry), C-03/C-04 start |
| 7 | Sat Aug 15 | A-11 + C-04 converge (CSV import), C-05 starts |
| 8 | Sun Aug 16 | A-12 + C-06 converge (Calendar sync), B-07 finishes |
| 9 | Mon Aug 17 | A-13 (forecast UI), B-08, A-14 (admin), C-07 |
| 10 | Tue Aug 18 | A-15/A-16/A-17, B-09/B-10, C-08/C-09 |
| 11 | **Wed Aug 19** | **FEATURE FREEZE (EOD).** A-18, C-10, cross-track integration testing. No new features merge after today. |
| 12 | Thu Aug 20 | Bug fixes only, seed realistic demo data, slide deck, full demo rehearsal against the promoted environment |

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Google OAuth app verification / consent-screen delays | Calendar sync blocked | Start C-05 by Day 7 at the latest; use a test-user allowlist so verification isn't required for the demo account |
| Claude API rate limits or cost during heavy testing | Quick Entry/CSV features flaky near deadline | Mock Claude in all automated tests ([`TESTING.md`](./TESTING.md)); use a low-volume dev key, share usage awareness in standup |
| Railway Postgres setup friction | Blocks everyone | C-01 on Day 1, not deferred — surfaces problems while there's still slack |
| CSV encoding issues (Hebrew bank exports, BOM, `,` vs `;` delimiters) | Import silently drops/mangles rows | Add explicit encoding-detection tests to C-04's Definition of Done |
| Three people, one repo, tight timeline | Merge conflicts, blocked branches | Branch per ticket (`a-05-envelope-dashboard`), small PRs, `main` always deployable, land B's contract changes fast since A depends on them |
| Scope creep past Day 11 | Feature freeze slips, demo prep suffers | Freeze is a hard non-negotiable, not a suggestion — anything not done by Wed Aug 19 EOD moves to [`OVERVIEW.md`](./OVERVIEW.md) § Extensions |

## Demo Script Outline

7-minute demo + 3-minute Q&A (`final_project.md` § Step 6):

1. **0:00–0:45** — Problem statement: budgeting tools look backward, Buddgy looks forward
2. **0:45–2:00** — Live: envelope dashboard, an envelope near depletion (status color visible)
3. **2:00–3:15** — Live: Quick Entry — type a free-text expense, show the AI-parsed confirmation, save it
4. **3:15–4:15** — Live: Calendar sync surfaces an upcoming planned expense, assign it to an envelope
5. **4:15–5:15** — Live: forecast banner shows a projected shortfall with a concrete recommendation
6. **5:15–6:00** — Quick CSV import demo (upload → mapping confirm → imported count)
7. **6:00–7:00** — Technical highlights: 3-track split, external integrations, and one challenge overcome
8. **7:00–10:00** — Q&A

Seed data for this (a demo user with realistic envelopes/transactions/planned expenses) is part of ticket A-18/C-10's Day 12 prep — don't demo against an empty account.

## Requirement Traceability

Every `final_project.md` technical requirement mapped to the ticket(s) that satisfy it:

| Requirement | Ticket(s) |
|---|---|
| React Router | A-02 |
| State management | A-01–A-03, [`STATE.md`](./STATE.md) |
| UI component library (Mantine) | A-01, A-03, [`DESIGN.md`](./DESIGN.md) |
| Responsive design | A-16 |
| Error handling reflected in UI | A-17 |
| Express MVC architecture | B-02–B-05 |
| Authentication & authorization | B-03, B-10 |
| Data validation | B-04, B-05 |
| Unified error handling | B-04 |
| SQL (PostgreSQL) | B-01, B-02 |
| External storage for media | C-07 |
| Deployment | C-01, C-10 |
| External API integration | C-02–C-06 (Claude, Google Calendar) |
| AI integration | C-02, C-03, A-10 |
