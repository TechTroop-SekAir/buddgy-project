// @ts-check
const { test, expect } = require('@playwright/test');
const { t } = require('./helpers/locale');
const { API_BASE_URL } = require('./helpers/env');

// This file intentionally does NOT set a default storageState — auth.setup.js
// completes onboarding server-side for the shared user/admin storageState
// files so the rest of the suite never lands on this route (see its comment).
// This spec needs a genuinely fresh user, with no onboarding_completed_at
// yet, so /onboarding is guaranteed to render — same reasoning as
// auth.spec.js's "registers a new user" test, which stops at the URL
// assertion and never exercises the wizard itself.

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

test('completes onboarding after first registration', async ({ page }) => {
  const email = `e2e-onboarding-${Date.now()}@buddgy.com`;

  await page.goto('/register');
  await page.getByLabel(t.auth.emailLabel).fill(email);
  await page.getByLabel(new RegExp(`^${t.auth.passwordLabel}`)).fill('password123');
  await page.getByLabel(t.auth.register.confirmPasswordLabel).fill('password123');
  await page.getByRole('button', { name: t.auth.register.submit }).click();

  // A never-onboarded user is redirected straight to the dedicated route
  // (docs/features/HOMEPAGE-FIXES.md § 4.3), not the homepage.
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: t.onboarding.title })).toBeVisible();

  // Income step: keep the default "primary salary" row, just fill an amount.
  await page.getByLabel(t.onboarding.income.amountLabel).fill('12000');
  await page.getByRole('button', { name: t.onboarding.income.continue }).click();

  // Categories step: pick two suggestions and continue to the 3rd step.
  const housingLabel = t.onboarding.categories.suggestions.housing.label;
  const transportLabel = t.onboarding.categories.suggestions.transport;
  await page.getByLabel(housingLabel, { exact: true }).check();
  await page.getByLabel(transportLabel, { exact: true }).check();
  await page.getByRole('button', { name: t.onboarding.categories.continue }).click();

  // Import step: optional and skippable — this run has no CSV to upload.
  await expect(page.getByText(t.onboarding.import.heading)).toBeVisible();
  await page.getByRole('button', { name: t.onboarding.import.skip }).click();

  // Finishing calls a real income replace, real category creates, and the
  // real PATCH /api/auth/onboarding — server/services/authService.js's
  // completeOnboarding(). The page redirects to the homepage and the chosen
  // categories show up as envelope cards.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(housingLabel, { exact: true })).toBeVisible();
  await expect(page.getByText(transportLabel, { exact: true })).toBeVisible();

  // Prove server-side persistence, not a client-local flag: clear all
  // localStorage (dropping only the JWT, which persistence must not depend
  // on) and reload — /onboarding must not reopen. Before the onboarding
  // backend shipped, this was the one assertion the client couldn't pass:
  // completion lived only in localStorage, so it was per-browser, not
  // per-account.
  const token = await page.evaluate(() => localStorage.getItem('buddgy_token'));
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((savedToken) => localStorage.setItem('buddgy_token', savedToken), token);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
});

// Regression test for a real bug (docs/logs/logs2508261411.md): if anything
// after category creation fails onboarding (a CSV import error, a crash, a
// refresh — anything), the user is left with categories in the DB but
// onboarding_completed_at still NULL. client/src/routes.jsx's OnboardingRoute
// then pins them to the wizard on every subsequent visit, and — before the
// fix in OnboardingPage.jsx — every retry 409'd on all of their categories,
// wedging them permanently. This reproduces exactly that starting state
// (categories already created, onboarding incomplete) by calling the real
// POST /api/envelopes directly, then proves a second real run through the
// wizard succeeds instead of wedging, with no duplicate cards.
test('finishing again after a partial onboarding does not 409 or duplicate categories', async ({ page }) => {
  const email = `e2e-onboarding-retry-${Date.now()}@buddgy.com`;
  const housingLabel = t.onboarding.categories.suggestions.housing.label;
  const transportLabel = t.onboarding.categories.suggestions.transport;
  const month = currentMonth();

  await page.goto('/register');
  await page.getByLabel(t.auth.emailLabel).fill(email);
  await page.getByLabel(new RegExp(`^${t.auth.passwordLabel}`)).fill('password123');
  await page.getByLabel(t.auth.register.confirmPasswordLabel).fill('password123');
  await page.getByRole('button', { name: t.auth.register.submit }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  // Simulate a prior attempt that got exactly as far as creating categories
  // before failing (e.g. the CSV confirm step erroring) — bypass the wizard
  // UI and call the real endpoint directly, same pattern as
  // auth.setup.js's markOnboardingComplete.
  const token = await page.evaluate(() => localStorage.getItem('buddgy_token'));
  for (const name of [housingLabel, transportLabel]) {
    const res = await page.request.post(`${API_BASE_URL}/envelopes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name, monthly_budget_agorot: 1, month },
    });
    expect(res.ok()).toBe(true);
  }

  // Re-enter the wizard fresh (onboarding_completed_at is still NULL) and run
  // it through again with the same category selections.
  await page.reload();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel(t.onboarding.income.amountLabel).fill('12000');
  await page.getByRole('button', { name: t.onboarding.income.continue }).click();

  await page.getByLabel(housingLabel, { exact: true }).check();
  await page.getByLabel(transportLabel, { exact: true }).check();
  await page.getByRole('button', { name: t.onboarding.categories.continue }).click();

  await page.getByRole('button', { name: t.onboarding.import.skip }).click();

  // The fix: a 409 on an already-existing category is tolerated, not
  // re-thrown, so this reaches the dashboard instead of getting stuck on
  // /onboarding with a duplicate-name error.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(housingLabel, { exact: true })).toHaveCount(1);
  await expect(page.getByText(transportLabel, { exact: true })).toHaveCount(1);
});

// Reproduction/regression test for a reported bug: onboarding's CSV step
// allegedly lets the user reach Finish with an incomplete column mapping,
// which the server rejects with a 400 (csvImportService.confirmImport's
// 'validation failed: mapping'), silently losing the import. Static reading
// of CsvImportStep.jsx shows the same `canConfirm` gate ImportPage.jsx uses
// already disables the button until both date and amount are mapped — this
// test is the live check of that, exercising the exact path the report
// describes (AI detection fails, forcing manual mapping — this suite runs
// with a broken ANTHROPIC_API_KEY per docs/TESTING.md's mocking policy, same
// as e2e/csv-import.spec.js's uploadAndMapManually, which this mirrors).
function buildCsv(suffix) {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return [
    'Date,Amount,Description',
    `${monthPrefix}-01,42.50,E2E Onboarding Import Row A ${suffix}`,
    `${monthPrefix}-02,18.00,E2E Onboarding Import Row B ${suffix}`,
  ].join('\n');
}

test('imports a CSV during onboarding without a 400, rows land unassigned on Transactions', async ({ page }) => {
  const email = `e2e-onboarding-csv-${Date.now()}@buddgy.com`;
  const suffix = Date.now();
  const rowA = `E2E Onboarding Import Row A ${suffix}`;
  const rowB = `E2E Onboarding Import Row B ${suffix}`;

  await page.goto('/register');
  await page.getByLabel(t.auth.emailLabel).fill(email);
  await page.getByLabel(new RegExp(`^${t.auth.passwordLabel}`)).fill('password123');
  await page.getByLabel(t.auth.register.confirmPasswordLabel).fill('password123');
  await page.getByRole('button', { name: t.auth.register.submit }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel(t.onboarding.income.amountLabel).fill('12000');
  await page.getByRole('button', { name: t.onboarding.income.continue }).click();
  await page.getByRole('button', { name: t.onboarding.categories.continue }).click();

  await expect(page.getByText(t.onboarding.import.heading)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'onboarding-sample-import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(buildCsv(suffix)),
  });
  await page.getByRole('button', { name: t.csvImport.select.submit }).click();

  await expect(page.getByText(t.csvImport.error.aiFailed)).toBeVisible();
  await page.getByRole('textbox', { name: t.csvImport.mapping.dateLabel }).click();
  await page.getByRole('option', { name: 'Date', exact: true }).click();
  await page.getByRole('textbox', { name: t.csvImport.mapping.amountLabel }).click();
  await page.getByRole('option', { name: 'Amount', exact: true }).click();
  await page.getByRole('textbox', { name: t.csvImport.mapping.descriptionLabel }).click();
  await page.getByRole('option', { name: 'Description', exact: true }).click();

  // The actual reproduction: watch the real confirm response rather than
  // inferring success/failure from the UI, so a 400 shows up unambiguously
  // even if the client swallowed it into the (correct, separately-verified)
  // csvImportFailed dashboard notice instead of an error on this page.
  const confirmResponse = page.waitForResponse((res) => /\/imports\/\d+\/confirm$/.test(res.url()));
  await page.getByRole('button', { name: t.onboarding.import.finish }).click();
  const response = await confirmResponse;
  expect(response.status()).toBe(200);

  await expect(page).toHaveURL(/\/dashboard$/);
  // By design (docs/API.md § CSV Import, same as the standalone /imports
  // page): CSV-imported rows are always envelope_id: null. They show up on
  // Transactions, not as spend on any envelope card.
  await page.goto('/transactions');
  await expect(page.getByText(rowA, { exact: true })).toBeVisible();
  await expect(page.getByText(rowB, { exact: true })).toBeVisible();
});

// Real-world reproduction of a reported bug: docs/csv/1_edited.csv is an
// actual Israeli credit-card export the user hit this with. It has 8 real
// transaction rows, then 3 trailing non-transaction rows the export tool
// appends (a blank row, a "סך הכל" / Total label row, a bare "1418.8₪" sum
// row) — all three have an unparseable date in the mapped column. Before the
// fix, confirmImport threw uncaught on the first one, 400ing the whole
// request and losing all 8 good rows with it (server/__tests__/csvImport.test.js
// covers the service layer directly; this proves the same fix end-to-end
// through the actual onboarding UI with the actual reported file).
test('imports a real bank export with trailing Total rows during onboarding — the reported bug', async ({ page }) => {
  const fs = require('fs');
  const path = require('path');
  const email = `e2e-onboarding-realcsv-${Date.now()}@buddgy.com`;
  const bankCsv = fs.readFileSync(path.join(__dirname, '..', 'docs', 'csv', '1_edited.csv'));

  await page.goto('/register');
  await page.getByLabel(t.auth.emailLabel).fill(email);
  await page.getByLabel(new RegExp(`^${t.auth.passwordLabel}`)).fill('password123');
  await page.getByLabel(t.auth.register.confirmPasswordLabel).fill('password123');
  await page.getByRole('button', { name: t.auth.register.submit }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel(t.onboarding.income.amountLabel).fill('12000');
  await page.getByRole('button', { name: t.onboarding.income.continue }).click();
  await page.getByRole('button', { name: t.onboarding.categories.continue }).click();

  await expect(page.getByText(t.onboarding.import.heading)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: '1_edited.csv',
    mimeType: 'text/csv',
    buffer: bankCsv,
  });
  await page.getByRole('button', { name: t.csvImport.select.submit }).click();

  await expect(page.getByText(t.csvImport.error.aiFailed)).toBeVisible();
  await page.getByRole('textbox', { name: t.csvImport.mapping.dateLabel }).click();
  await page.getByRole('option', { name: 'תאריך עסקה', exact: true }).click();
  await page.getByRole('textbox', { name: t.csvImport.mapping.amountLabel }).click();
  await page.getByRole('option', { name: 'סכום חיוב', exact: true }).click();
  await page.getByRole('textbox', { name: t.csvImport.mapping.descriptionLabel }).click();
  await page.getByRole('option', { name: 'שם בית העסק', exact: true }).click();

  const confirmResponse = page.waitForResponse((res) => /\/imports\/\d+\/confirm$/.test(res.url()));
  await page.getByRole('button', { name: t.onboarding.import.finish }).click();
  const response = await confirmResponse;

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data).toEqual({ imported: 8, duplicatesSkipped: 0, unparseableSkipped: 3 });

  await expect(page).toHaveURL(/\/dashboard$/);
});
