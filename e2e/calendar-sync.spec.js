// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { t, pluralRegex } = require('./helpers/locale');

test.use({ storageState: path.join(__dirname, '.auth', 'user.json') });

// Calendar sync (qa.md § E2E Tests): connect -> sync -> confirm a planned
// expense. Runs against the app's own client-side calendar mock
// (VITE_USE_MOCK_CALENDAR=true, client/src/services/mockCalendarService.js)
// instead of live Google OAuth — no real credentials are used or needed.
// The mock keys its state off localStorage, which Playwright loads fresh
// from the saved auth storageState on every test run, so this spec needs no
// separate disconnect/cleanup step to stay repeatable.
test('connects the calendar, syncs planned expenses, and confirms one', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: t.calendar.connect })).toBeVisible();
  await page.getByRole('button', { name: t.calendar.connect }).click();

  await expect(page).toHaveURL(/calendar=connected/);
  await expect(page.getByText(t.calendar.callbackSuccess)).toBeVisible();
  await expect(page.getByText(t.calendar.connected, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: t.calendar.sync }).click();
  // The mock always creates 3 events (mockCalendarService.js's
  // SAMPLE_EVENTS), but one is dated far enough out that it can land in next
  // month depending on today's date — assert sync happened, not an exact
  // count that's incidentally date-dependent.
  await expect(page.getByText(pluralRegex(t.calendar.syncResult_other))).toBeVisible();

  await page.goto('/planned-expenses');
  const confirmButtons = page.getByRole('button', { name: t.plannedExpenses.confirm });
  // .count() doesn't auto-wait the way expect(...).toBeVisible() does — the
  // mock service's own artificial delay plus the query's render cycle mean
  // an immediate count() would race the loading state. Wait for the first
  // row for real before counting.
  await expect(confirmButtons.first()).toBeVisible();
  const initialCount = await confirmButtons.count();

  await confirmButtons.first().click();
  await expect(confirmButtons).toHaveCount(initialCount - 1);
});
