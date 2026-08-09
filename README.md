# Buddgy

A monthly budgeting app built on the Envelope Budgeting method — AI-parsed quick entry, CSV import, and Google Calendar sync feed forward-looking cash-flow forecasts. See [`docs/README.md`](./docs/README.md) for the full spec.

## Getting started

```bash
git clone <repo-url>
cd "Final Project"
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, etc.
cp client/.env.example client/.env
npm run install:all
npm run --prefix server db:migrate
npm run dev                    # server on :4000 (or PORT), client on :5173
```

Requires Node 20 (see `.nvmrc`) and a local PostgreSQL instance.

## Repo layout

Two independent packages — `client/` (React + Vite) and `server/` (Express) — each with their own `package.json`, run together via the root `npm run dev`. Deployed as two separate Railway services from this one repo; see [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Docs

Start at [`docs/README.md`](./docs/README.md) — every spec file there opens with a `## Contents` table.
