#!/bin/bash

# One-time local setup for ticket A-18's Playwright E2E suite (e2e/).
# A dedicated database, separate from buddgy_dev/buddgy_test, so E2E runs
# never race with (or get wiped by) the Jest integration suite's
# TRUNCATE-between-tests (server/tests/helpers/db.js's resetDb()).
# Idempotent: safe to re-run.

set -e

cd "$(dirname "$0")/.."

echo "==========================================="
echo "🐳 Ensuring Postgres container is up..."
echo "==========================================="
docker compose up -d --wait db

echo "==========================================="
echo "🗄️  Creating buddgy_e2e database (if missing)..."
echo "==========================================="
EXISTS=$(docker compose exec -T db psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='buddgy_e2e'")
if [ "$EXISTS" = "1" ]; then
  echo "buddgy_e2e already exists — skipping."
else
  docker compose exec -T db createdb -U postgres buddgy_e2e
  echo "buddgy_e2e created."
fi

echo "==========================================="
echo "🗄️  Running migrations against buddgy_e2e..."
echo "==========================================="
DATABASE_URL="postgres://postgres:postgres@localhost:5432/buddgy_e2e" npm run --prefix server db:migrate

echo "==========================================="
echo "✅ buddgy_e2e is ready. Run the E2E suite with:"
echo "   npm run test:e2e"
echo "==========================================="
