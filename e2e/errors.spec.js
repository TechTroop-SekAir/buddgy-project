// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { t } = require('./helpers/locale');

test.use({ storageState: path.join(__dirname, '.auth', 'user.json') });

// Error flows (qa.md § E2E Tests): form validation, API failure, unauthorized
// access — the three cases the client/CLAUDE.md Async UX Contract requires
// every page/form to handle (see A-17's Alert/EmptyState primitives).

test('shows inline validation instead of submitting an invalid form', async ({ page }) => {
  await page.goto('/dashboard');
  const addTrigger = page
    .getByRole('button', { name: t.dashboard.addFirstCategory })
    .or(page.getByRole('button', { name: t.dashboard.addCategory }));
  await addTrigger.click();

  const dialog = page.getByRole('dialog');
  // A single space passes the native HTML `required` attribute but fails
  // the app's own trim-aware validation — a real client-side rejection,
  // not the browser's native constraint-validation tooltip.
  await dialog.getByLabel(t.addCategoryModal.nameLabel).fill(' ');
  await dialog.getByLabel(t.addCategoryModal.budgetLabel).fill('0');
  await dialog.getByRole('button', { name: t.addCategoryModal.submit }).click();

  await expect(dialog.getByText(t.addCategoryModal.nameRequired)).toBeVisible();
  await expect(dialog.getByText(t.addCategoryModal.budgetInvalid)).toBeVisible();
  // Still open — an invalid submit must never look like it saved.
  await expect(dialog).toBeVisible();
});

test('surfaces a real API failure as a translated alert, not a blank page', async ({ page }) => {
  await page.route('**/envelopes**', (route) => {
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ data: null, error: 'boom' }) });
  });

  await page.goto('/dashboard');
  // React Query's default retry (3 attempts, exponential backoff) means the
  // error state takes longer to settle than the default assertion timeout.
  await expect(page.getByText(t.dashboard.error)).toBeVisible({ timeout: 15000 });
});

test('an expired session redirects to login instead of erroring silently', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.evaluate(() => localStorage.setItem('buddgy_token', 'not-a-real-token'));
  await page.goto('/transactions');

  await expect(page).toHaveURL(/\/login$/);
});
