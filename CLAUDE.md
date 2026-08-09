# CLAUDE.md — Project Constitution

> This file is always active. It defines the project's non-negotiables: stack, structure,
> conventions, and boundaries. Every session starts here.
> For role-specific instructions, use `/dev`, `/product`, or `/qa`.

---

## Project Overview

**App:** Buddgy
**Purpose:** A monthly budgeting app built on the Envelope Budgeting method. Users pre-allocate a budget to spending "envelopes" and track balances via AI-parsed free-text entry, CSV import, and Google Calendar sync of upcoming planned expenses, with forward-looking cash-flow forecasts.
**Stage:** MVP
**Users:** Guest (landing page, method explanation, read-only demo), Registered User (envelopes, transactions, imports, calendar sync, forecasts), Admin (global category catalog, user management, usage stats)

---

## Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React (Vite), React Router        |
| UI Components | Mantine — imported only inside `client/src/components/ui/`, swappable |
| Styling     | Tailwind (layout/spacing) + CSS custom properties (tokens) |
| Backend     | Node.js, Express                  |
| ORM         | Sequelize                         |
| Database    | PostgreSQL                        |
| Auth        | JWT                               |
| Testing     | Jest, Supertest, Playwright       |
| Deployment  | Railway (backend and frontend)     |

---

## Project Structure

```
/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # Shared, reusable UI components
│   │   ├── pages/           # Route-level page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── context/         # React context providers
│   │   ├── services/        # API call functions (axios/fetch wrappers)
│   │   ├── components/ui/   # Thin adapters over the UI library (Mantine) — the ONLY place it's imported
│   │   └── utils/           # Pure utility functions
│   └── ...
├── server/                  # Express backend
│   ├── controllers/         # Route handler logic
│   ├── routes/              # Express router definitions
│   ├── models/              # Sequelize models
│   ├── migrations/          # Sequelize migrations (source of truth for schema)
│   ├── seeders/             # Sequelize seed files
│   ├── middleware/          # Auth, error handling, validation
│   ├── services/            # Business logic, external API calls
│   └── utils/               # Shared helpers
├── CLAUDE.md                # ← You are here
├── docs/                     # Spec source of truth — see docs/README.md for the index
│   ├── README.md
│   ├── OVERVIEW.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── STATE.md
│   ├── INTEGRATIONS.md
│   ├── SECURITY.md
│   ├── DESIGN.md              # Palette, tokens, status colors — referenced by .claude/commands/design.md
│   ├── TESTING.md
│   ├── DEPLOYMENT.md
│   └── PLAN.md                 # 12-day delivery board, tracks, critical path
└── .claude/commands
    ├── product.md
    ├── dev.md
    ├── qa.md
    └── design.md                # Design system reference — component patterns and token rules
```

---

## Reading the Docs

Every file in `docs/` starts with a `## Contents` table right after its title. **Read the Contents block first, then read only the sections a task actually needs** — don't read a spec file end-to-end unless the task genuinely spans it. When you add a section to a doc, add its row to that file's Contents table in the same edit. Start at `docs/README.md` if you don't know which file covers a topic.

---

## Naming Conventions

- **Files:** `camelCase.js` for JS modules, `PascalCase.jsx` for React components
- **DB tables:** `snake_case`, plural (e.g. `user_profiles`)
- **Sequelize models:** `PascalCase`, singular (e.g. `UserProfile`)
- **API routes:** `kebab-case`, RESTful (e.g. `GET /api/user-profiles/:id`)
- **Env vars:** `SCREAMING_SNAKE_CASE`
- **React components:** one component per file, filename matches component name

---

## Environment Variables

Never hardcode secrets. All sensitive values live in `.env` (gitignored).
Always document new vars in `.env.example` with a placeholder value.

```
DATABASE_URL=
JWT_SECRET=
CLIENT_URL=
PORT=
NODE_ENV=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
ANTHROPIC_API_KEY=
CLOUDINARY_URL=
```

---

## Database Rules

- **Migrations are the source of truth** for schema. Never alter tables manually.
- Always write a `down` migration that fully reverses the `up`.
- This project targets PostgreSQL only — raw SQL may use Postgres-specific syntax freely.
- Use transactions for any multi-step write operation.
- No `SELECT *` in production queries — always specify columns.
- All monetary amounts are stored as **integers in agorot** (never floats) to avoid rounding errors — column names end in `_agorot`.
- `transactions.dedup_hash` and `planned_expenses.google_event_id` are UNIQUE — imports and calendar syncs must be idempotent.

---

## API Design Rules

- All routes prefixed with `/api`
- Consistent response envelope:
  ```json
  { "data": ..., "error": null }
  { "data": null, "error": "message" }
  ```
- HTTP status codes must be semantically correct (don't return 200 with an error body)
- Input validation happens in middleware, not in controllers
- Controllers are thin — business logic lives in services

---

## Error Handling

- Express: always use the centralized error middleware (`server/middleware/errorHandler.js`)
- Never swallow errors silently (`catch (e) {}` is forbidden)
- Client-facing errors must never expose stack traces or internal details
- Log errors server-side with enough context to debug

---

## External Integrations

- **Google Calendar API** (OAuth2) — primary external API; syncs upcoming events with an amount in the title into `planned_expenses`. `google_refresh_token` on `users` is encrypted at rest.
- **Anthropic Claude API** — powers AI Quick Entry (free text → structured JSON: amount/category/envelope/date) and CSV column-mapping detection. Always show the parsed result to the user for confirmation before saving — never auto-save an AI-parsed transaction.
- **Cloudinary / AWS S3** — external storage for profile pictures and uploaded CSV files; never store binary files in the DB.

---

## Non-Negotiables

- No `console.log` left in committed code (use a logger)
- No hardcoded IDs, URLs, or magic numbers
- All async route handlers wrapped in try/catch (or an async wrapper utility)
- Auth middleware applied at the router level, not ad-hoc per route
- No direct DB calls from React — always through the API layer
- No hardcoded design values (colors, sizes, radii) — all styling goes through `client/src/styles/tokens.css` and Tailwind utility classes