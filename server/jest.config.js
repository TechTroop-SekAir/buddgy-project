'use strict';

// Default config, used by `npm test` — the mocked, DB-free unit layer
// (server/__tests__/). Explicitly excludes server/tests/, the separate
// real-Postgres integration layer (ticket B-09, run via `npm run
// test:integration` / jest.integration.config.js) — without this, Jest's
// default testMatch would happily pick up *.test.js files there too and
// try to run them without DATABASE_URL pointed at a test database.
module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/'],
};
