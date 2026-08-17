'use strict';

// Runs the given command with DATABASE_URL swapped to DATABASE_URL_TEST and
// NODE_ENV forced to 'test' — backs `test:integration` / `db:migrate:test`
// (ticket B-09) so integration tests/migrations never touch the dev DB.
//
// A plain `"DATABASE_URL=$DATABASE_URL_TEST npm run ..."` script doesn't
// work here: that shell substitution reads the CALLING shell's environment,
// before dotenv has ever loaded server/.env. This script loads .env itself
// first, then spawns the real command with the swapped env.
require('dotenv').config();
const { spawnSync } = require('child_process');

if (!process.env.DATABASE_URL_TEST) {
  console.error(
    'DATABASE_URL_TEST is not set. Add it to server/.env (see .env.example) — ' +
      'scripts/create-test-db.sh sets up the database it should point at.'
  );
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
const result = spawnSync(command, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL_TEST,
    NODE_ENV: 'test',
  },
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
