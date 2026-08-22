// @ts-check
const { test, expect } = require('@playwright/test');
const { t } = require('./helpers/locale');

// This file intentionally does NOT set a default storageState — auth.setup.js
// completes onboarding server-side for the shared user/admin storageState
// files so the rest of the suite never lands on this route (see its comment).
// This spec needs a genuinely fresh user, with no onboarding_completed_at
// yet, so /onboarding is guaranteed to render — same reasoning as
// auth.spec.js's "registers a new user" test, which stops at the URL
// assertion and never exercises the wizard itself.
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

  // Categories step: pick two suggestions and finish.
  const housingLabel = t.onboarding.categories.suggestions.housing.label;
  const transportLabel = t.onboarding.categories.suggestions.transport;
  await page.getByLabel(housingLabel, { exact: true }).check();
  await page.getByLabel(transportLabel, { exact: true }).check();
  await page.getByRole('button', { name: t.onboarding.categories.finish }).click();

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
