'use strict';

// Config for `npm run test:integration` (ticket B-09) — the real-Postgres
// layer under server/tests/, distinct from the default jest.config.js which
// only runs the mocked server/__tests__/ suite. Only ever invoked through
// server/scripts/runWithTestDb.js, which points DATABASE_URL at
// DATABASE_URL_TEST before Jest starts.
module.exports = {
  testMatch: ['<rootDir>/tests/**/*.integration.test.js'],
};
