// @ts-check
const { execFileSync } = require('child_process');
const path = require('path');
const { E2E_DATABASE_URL } = require('./helpers/db');

const DATABASE_URL = E2E_DATABASE_URL;
const SERVER_DIR = path.join(__dirname, '..', 'server');

// Runs once before the whole suite (see playwright.config.js). Idempotent —
// `db:migrate` skips already-applied migrations, and server/seed.js uses
// findOrCreate/ignoreDuplicates, so re-running this against a DB that
// already has data from a previous run is safe and leaves it untouched.
module.exports = async function globalSetup() {
  const env = { ...process.env, DATABASE_URL };

  console.log('[e2e/global-setup] migrating buddgy_e2e...');
  execFileSync('npm', ['run', 'db:migrate'], { cwd: SERVER_DIR, env, stdio: 'inherit', shell: true });

  console.log('[e2e/global-setup] seeding base accounts...');
  execFileSync('node', ['seed.js'], { cwd: SERVER_DIR, env, stdio: 'inherit' });
};
