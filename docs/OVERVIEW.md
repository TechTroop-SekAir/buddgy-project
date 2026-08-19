# Buddgy — Overview

Specification Document — Full-Stack Final Project | August 2026

## Contents

| Section | What's in it |
|---|---|
| [Team](#team) | Who's building this |
| [Description](#description) | What Buddgy is and why it's different |
| [Target Users](#target-users) | Guest / Registered User / Admin |
| [Use Cases](#use-cases-per-user) | What each role can do |
| [Mockups](#mockups) | Main screens (see original `.docx` for hand-drawn versions) |
| [Extensions](#extensions) | Stretch goals, implemented only after MVP is done |

Related specs: [`DATABASE.md`](./DATABASE.md) · [`API.md`](./API.md) · [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`INTEGRATIONS.md`](./INTEGRATIONS.md)

---

## Team

- Darya Abbassov
- Matan Maabari
- Ofek Cofman

## Description

Buddgy is a monthly budgeting app built on the Envelope Budgeting method: the user pre-allocates a set amount to each spending category ("envelope") and tracks the remaining balance in each one.

- **Core differentiator:** Unlike existing expense-tracking tools that look backward ("where did my money go"), Buddgy looks forward — it pulls upcoming planned expenses from Google Calendar and warns the user in advance if they're not on track to stay within budget.
- **The AI component:** Expenses are entered in free-form text ("coffee and a pastry, 34 shekels"), and a language model extracts structured JSON from it — amount, category, envelope and date. AI sits in the core daily-use flow, not bolted on as an extra.
- **Why not a direct bank connection:** Automatic bank-account syncing requires licensing and secure credential handling. Instead, the system offers three complementary input channels: AI-based quick entry, CSV import with automatic column mapping, and calendar sync.

## Target Users

- **Guest** — Not logged in. Can view the landing page, the method explanation, and a read-only demo.
- **Registered User** — The core user of the system. Manages envelopes, transactions, imports and forecasts.
- **Admin** — System administrator. Manages the global category catalog and users.

## Use Cases (Per User)

### Guest

- View landing page and explanation of the Envelope Budgeting method
- Sign up via email and password / log in
- View a static demo of the envelope dashboard (read-only)

### Registered User

Has all Guest use cases, plus:

- Create, edit and delete envelopes and set a monthly budget per envelope
- Enter an expense in free-form text — the system parses amount, category and envelope and shows it for confirmation before saving
- Add, edit and delete a transaction manually
- Upload a CSV/Excel bank statement, confirm automatic column mapping, and bulk-import
- Connect a Google account and sync calendar events with an amount as future expenses
- Assign a future expense to an envelope and approve or dismiss it
- View end-of-month cash-flow forecast and a warning for a projected shortfall
- Filter and search transactions by envelope, date and amount
- View history of previous months
- Upload a profile picture (external storage)

### Admin

Has all Registered User use cases, plus:

- Manage the global category catalog used by the classification engine
- View the user list and disable a user
- View basic usage statistics (number of users, transactions created, AI calls)

## Mockups

- Screen 1 — Envelope dashboard: remaining balance per envelope and forecast alert
- Screen 2 — Quick Entry: free text parsed into structured JSON, shown for confirmation
- Screen 3 — Cash-flow forecast based on Google Calendar events

Hand-drawn versions live in `Buddgy_Spec.docx` (original TA submission). See [`DESIGN.md`](./DESIGN.md) for the token-level visual direction these get built against.

## Extensions

To be implemented only after all use cases above are complete:

- Photograph a receipt and generate an expense from it using a vision model (OCR + LLM)
- Shared envelopes for a couple or household with permissions
- Automated monthly email report with summary and trend analysis
- Savings goals (sinking funds) across multiple months
- PWA with push notifications when an envelope nears depletion
- Export data to CSV and to Google Sheets
- AI agents: a Budget Advisor that answers free-text spending questions against real budget data, and a Calendar Sync Conflict agent that flags duplicate/ambiguous planned expenses after a sync — see [`features/AGENTS.md`](./features/AGENTS.md)
- Upcoming Events: classify every synced calendar event (not just ones with an amount in the title) by likelihood of costing money, with dismiss/undo and a spend prompt — see [`features/UPCOMING-EVENTS.md`](./features/UPCOMING-EVENTS.md)
