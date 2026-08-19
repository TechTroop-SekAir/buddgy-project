// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

// Ticket A-18. Deliberately separate ports from the normal dev setup
// (4000/5173) so this suite never collides with — or accidentally talks
// to — a developer's regular `npm run dev` session or its buddgy_dev
// database. See e2e/README.md-equivalent notes in this file's comments and
// the plan at .claude/plans (A-18) for the full rationale.
const SERVER_PORT = 4010;
const CLIENT_PORT = 5183;
const BASE_URL = `http://localhost:${CLIENT_PORT}`;

// Dummy values only, same pattern as .github/workflows/ci.yml, EXCEPT
// CLOUDINARY_URL (see its own comment below) — Claude and Google Calendar
// are mocked/deliberately broken for this suite (e2e/quick-entry.spec.js,
// e2e/calendar-sync.spec.js), so nothing else here needs to be real.
const SERVER_ENV = {
  NODE_ENV: 'development',
  PORT: String(SERVER_PORT),
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/buddgy_e2e',
  JWT_SECRET: 'e2e-test-jwt-secret',
  CLIENT_URL: BASE_URL,
  // Deliberately invalid — client/CLAUDE.md forbids auto-saving an
  // AI-parsed transaction, and the app already has a real fallback path for
  // when Claude is unreachable (server/services/claudeService.js throws,
  // QuickEntryModal/ImportPage fall back to local parsing / manual mapping
  // with a user-facing notice). Using a bad key exercises that real path
  // instead of building separate mock infrastructure — see docs/TESTING.md
  // § Mocking Policy: Claude must never be called live.
  ANTHROPIC_API_KEY: 'e2e-invalid-anthropic-key',
  GOOGLE_CLIENT_ID: 'e2e-test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'e2e-test-google-client-secret',
  GOOGLE_REDIRECT_URI: `http://localhost:${SERVER_PORT}/api/calendar/callback`,
  ENCRYPTION_KEY: 'ecc566c5c69751d829a733e15772f7340ca782a9aeb1f2366aa5de39642254da',
  // Deliberately NOT set here, unlike everything above — storage (Cloudinary)
  // isn't covered by docs/TESTING.md's Mocking Policy (that's Claude and
  // Google Calendar only) and, unlike an AI outage, the app has no graceful
  // fallback for a failed upload — csv-import.spec.js genuinely needs a
  // working account. Omitting the key here means the spawned server process
  // falls through to whatever CLOUDINARY_URL it finds in its own
  // environment: server/.env locally (see server/services/storageService.js;
  // dotenv only fills in keys not already set), or CI's CLOUDINARY_URL
  // secret (see .github/workflows/ci.yml's `client` job).
};

// VITE_* vars are baked in at build time, not read at serve time — this is
// why the client webServer command builds and then previews, rather than
// running the vite dev server (client/src/services/api.js, authService.js,
// calendarService.js all read import.meta.env.VITE_*).
const CLIENT_ENV = {
  VITE_API_URL: `http://localhost:${SERVER_PORT}/api`,
  // Real auth/category/transaction flows (categoryService.js/
  // transactionService.js are never mock-gated — see client/CLAUDE.md), but
  // the Calendar OAuth dance is mocked so no live Google credentials are
  // needed for e2e/calendar-sync.spec.js. Planned-expense CRUD used to ride
  // along on VITE_USE_MOCK_CALENDAR (see plannedExpenseService.js's header
  // comment) but has its own flag now, left false here so
  // e2e/planned-expenses.spec.js's confirm flow hits the real
  // transaction/envelope-spent effects instead of a localStorage mock.
  VITE_USE_MOCK_API: 'false',
  VITE_USE_MOCK_CALENDAR: 'true',
  VITE_USE_MOCK_PLANNED_EXPENSES: 'false',
};

module.exports = defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup.js'),
  fullyParallel: false, // shared buddgy_e2e database — specs run in file order, not concurrently
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.js/,
    },
  ],

  webServer: [
    {
      command: 'node server.js',
      cwd: path.join(__dirname, 'server'),
      env: SERVER_ENV,
      url: `http://localhost:${SERVER_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: `npm run build && npm run preview -- --port ${CLIENT_PORT} --strictPort`,
      cwd: path.join(__dirname, 'client'),
      env: CLIENT_ENV,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
