// Derives the e2e suite's Postgres URL from server/.env instead of a
// hardcoded `postgres:postgres` login — that login doesn't exist on every
// machine (it's whatever the local Postgres install's password actually is,
// see server/.env's DATABASE_URL), so the old hardcoded value only ever
// worked in CI, where DATABASE_URL is injected fresh. The database name is
// still forced to `buddgy_e2e`, not whatever server/.env points at — this
// suite must never touch a developer's real buddgy_dev/buddgy_test data
// (see global-setup.js's header comment).
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '..', 'server', '.env');

// Minimal KEY=VALUE parser — avoids depending on the `dotenv` package here,
// since this file is required from playwright.config.js/global-setup.js at
// the repo root, outside server/'s own node_modules.
function readEnvFile(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const fileVars = readEnvFile(ENV_FILE);
// process.env wins, matching dotenv's own precedence, so CI's injected
// DATABASE_URL still overrides anything checked into server/.env locally.
const sourceUrl =
  process.env.DATABASE_URL || process.env.DATABASE_URL_TEST || fileVars.DATABASE_URL || fileVars.DATABASE_URL_TEST;

if (!sourceUrl) {
  throw new Error(
    'e2e/helpers/db.js: no DATABASE_URL/DATABASE_URL_TEST found in the environment or server/.env — ' +
      'the e2e suite needs real Postgres credentials to build its own buddgy_e2e connection string from.'
  );
}

const parsed = new URL(sourceUrl);
parsed.pathname = '/buddgy_e2e';
const E2E_DATABASE_URL = parsed.toString();

module.exports = { E2E_DATABASE_URL };
