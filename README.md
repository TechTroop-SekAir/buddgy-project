# Buddgy

A monthly budgeting app built on the Envelope Budgeting method — AI-parsed quick entry, CSV import, and Google Calendar sync feed forward-looking cash-flow forecasts. See [`docs/README.md`](./docs/README.md) for the full spec.

## Getting started

```bash
git clone <repo-url>
cd "Final Project"
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, etc.
cp client/.env.example client/.env
npm run install:all
./scripts/update-db.sh         # sets up or updates the database automatically
npm run dev                    # server on :4000 (or PORT), client on :5173
```

Requires Node 20 (see `.nvmrc`) and Docker (for local PostgreSQL — no native Postgres install
needed). Point your local `DATABASE_URL` at `postgres://postgres:postgres@localhost:5432/buddgy_dev`
to match `docker-compose.yml`'s credentials.

## Database Setup & Updates

For convenience, a script is included in the `scripts/` folder to handle everything related to your local PostgreSQL instance. Whenever you clone the project for the first time, or pull new changes from your teammates, simply run:

```bash
./scripts/update-db.sh
```

**What this script does automatically:**
1. Pulls the latest code changes (`git pull`)
2. Spins up the Postgres container via Docker and waits until it's healthy
3. Runs any pending database migrations (`npm run --prefix server db:migrate`)
4. Seeds the database with default development data and test users (`npm run --prefix server db:seed:dev`)

## Repo layout

Two independent packages — `client/` (React + Vite) and `server/` (Express) — each with their own `package.json`, run together via the root `npm run dev`. Deployed as two separate Railway services from this one repo; see [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Docs

Start at [`docs/README.md`](./docs/README.md) — every spec file there opens with a `## Contents` table.
