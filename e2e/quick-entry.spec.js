// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { t } = require('./helpers/locale');

test.use({ storageState: path.join(__dirname, '.auth', 'user.json') });

// AI Quick Entry (qa.md § E2E Tests): free text -> parsed suggestion shown ->
// user confirms -> saved as a transaction. The suite runs with a
// deliberately invalid ANTHROPIC_API_KEY (playwright.config.js), so this
// exercises the app's real "AI unreachable" fallback
// (client/src/utils/parseQuickEntryText.js) rather than a live Claude call —
// docs/TESTING.md's Mocking Policy requires Claude never be called live.
test('parses free text locally when AI is unavailable, then saves it', async ({ page }) => {
  // No digits anywhere in this description, including the literal "E2E" —
  // client/src/utils/parseQuickEntryText.js extracts the *first* digit run
  // it finds in the whole string (the "2" in "E2E" would win over "42").
  const suffix = Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
  const description = `Coffee test ${suffix}`;

  await page.goto('/dashboard');
  await page.getByRole('button', { name: t.dashboard.addTransaction }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(t.quickEntry.input.label).fill(`${description} 42 shekels`);
  await dialog.getByRole('button', { name: t.quickEntry.input.submit }).click();

  // Falls through to local parsing and says so, instead of silently
  // degrading (client/src/components/transactions/QuickEntryModal.jsx).
  await expect(dialog.getByText(t.quickEntry.review.aiUnavailableNotice)).toBeVisible();
  await expect(dialog.getByLabel(t.quickEntry.review.amountLabel)).toHaveValue('42');
  await expect(dialog.getByLabel(t.quickEntry.review.descriptionLabel)).toHaveValue(description);

  await dialog.getByRole('button', { name: t.quickEntry.review.confirm }).click();
  await expect(dialog).toBeHidden();

  await page.goto('/transactions');
  await expect(page.getByText(description, { exact: true })).toBeVisible();
});
