#!/bin/bash

# One-time local setup for ticket B-09's integration test layer
# (server/tests/, `npm run test:integration`). Postgres can host multiple
# databases on one server, so this is just a second database on the same
# `db` container docker-compose.yml already defines — no compose changes.
# Idempotent: safe to re-run.

set -e

cd "$(dirname "$0")/.."

echo "==========================================="
echo "🐳 Ensuring Postgres container is up..."
echo "==========================================="
docker compose up -d --wait db

echo "==========================================="
echo "🗄️  Creating buddgy_test database (if missing)..."
echo "==========================================="
EXISTS=$(docker compose exec -T db psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='buddgy_test'")
if [ "$EXISTS" = "1" ]; then
  echo "buddgy_test already exists — skipping."
else
  docker compose exec -T db createdb -U postgres buddgy_test
  echo "buddgy_test created."
fi

echo "==========================================="
echo "🗄️  Running migrations against buddgy_test..."
echo "==========================================="
npm run --prefix server db:migrate:test

echo "==========================================="
echo "✅ buddgy_test is ready. Set DATABASE_URL_TEST in your .env, then run:"
echo "   npm run --prefix server test:integration"
echo "==========================================="
