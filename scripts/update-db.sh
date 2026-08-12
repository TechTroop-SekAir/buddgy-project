#!/bin/bash

# Exit immediately if any command exits with a non-zero status
set -e

# Automatically move to the project root directory (one level up from this script)
cd "$(dirname "$0")/.."

echo "==========================================="
echo "🔄 Updating Project & Database..."
echo "==========================================="

echo "📥 1. Pulling latest changes from Git..."
git pull

echo "🐳 2. Starting Postgres container in Docker..."
docker compose up -d --wait db

echo "🗄️ 3. Running database migrations..."
npm run --prefix server db:migrate

echo "🌱 4. Seeding development database..."
npm run --prefix server db:seed:dev

echo "==========================================="
echo "✅ Success! Everything is up to date and healthy."
echo "==========================================="
