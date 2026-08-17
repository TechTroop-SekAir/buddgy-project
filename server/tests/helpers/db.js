'use strict';

// Real-DB helper for the ticket B-09 integration layer — deliberately the
// ONLY place in this test suite that imports the real `../../models`
// (server/__tests__/ mocks it everywhere; that's the whole distinction
// between the two layers, per .claude/commands/qa.md § Test Layers).
//
// Every suite under server/tests/ must run against DATABASE_URL_TEST, never
// dev/prod — enforced by always going through `npm run test:integration`
// (server/scripts/runWithTestDb.js swaps DATABASE_URL before Jest starts).
// This file adds a second, cheap guard: refuse to truncate anything unless
// the connected database's name ends in `_test`, so a misconfigured env
// can't wipe real data.
const { sequelize } = require('../../models');

// snake_case, plural table names — must match server/models/index.js's
// registered models. Order doesn't matter: TRUNCATE ... CASCADE in one
// statement handles FKs among the listed tables regardless of order.
const TABLES = ['ai_calls', 'csv_imports', 'planned_expenses', 'transactions', 'envelopes', 'categories', 'users'];

function assertTestDatabase() {
  const { database } = sequelize.config;
  if (!database || !database.endsWith('_test')) {
    throw new Error(
      `refusing to truncate tables against database "${database}" — it doesn't look like a ` +
        'test database (expected a name ending in "_test"). Run via `npm run test:integration`, ' +
        'which points DATABASE_URL at DATABASE_URL_TEST.'
    );
  }
}

/** Wipes every table and resets identity sequences — call in beforeEach so each test starts from a clean slate. */
async function resetDb() {
  assertTestDatabase();
  const quoted = TABLES.map((t) => `"${t}"`).join(', ');
  await sequelize.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
}

/** Closes the Sequelize connection pool — call once in afterAll so Jest can exit cleanly. */
async function closeDb() {
  await sequelize.close();
}

module.exports = { resetDb, closeDb };
