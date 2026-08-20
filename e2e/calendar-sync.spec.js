// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { t, pluralRegex } = require('./helpers/locale');

test.use({ storageState: path.join(__dirname, '.auth', 'user.json') });

// Calendar sync (qa.md § E2E Tests): connect -> sync. Runs against the
// app's own client-side calendar mock (VITE_USE_MOCK_CALENDAR=true,
// client/src/services/mockCalendarService.js) instead of live Google OAuth —
// no real credentials are used or needed. The mock keys its state off
// localStorage, which Playwright loads fresh from the saved auth
// storageState on every test run, so this spec needs no separate
// disconnect/cleanup step to stay repeatable.
//
// This used to also confirm a synced planned expense here, but
// plannedExpenseService.js has its own independent mock flag now
// (VITE_USE_MOCK_PLANNED_EXPENSES=false in playwright.config.js) so that
// confirming hits the real backend and its transaction/envelope-spent
// effects — see e2e/planned-expenses.spec.js. mockCalendarService.js's
// synced rows are localStorage-only and won't appear on the real Planned
// Expenses page, so this spec no longer asserts on them.
test('connects the calendar and syncs planned expenses', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: t.calendar.connect })).toBeVisible();
  await page.getByRole('button', { name: t.calendar.connect }).click();

  // Not asserting on the intermediate `?calendar=connected` URL here: the
  // connect flow does a full page reload to that URL, but SettingsPage's own
  // mount effect strips the query param again via history.replace within
  // ~30ms of mounting — a window too small for toHaveURL's polling to catch
  // reliably (confirmed by instrumenting the real timings). The banner/badge
  // below are the actual outcome that matters and are stable once shown.
  await expect(page.getByText(t.calendar.callbackSuccess)).toBeVisible();
  await expect(page.getByText(t.calendar.connected, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: t.calendar.sync }).click();
  // The mock always creates 3 events (mockCalendarService.js's
  // SAMPLE_EVENTS), but one is dated far enough out that it can land in next
  // month depending on today's date — assert sync happened, not an exact
  // count that's incidentally date-dependent.
  await expect(page.getByText(pluralRegex(t.calendar.syncResult_other))).toBeVisible();
});
