// @ts-check
const { test, expect } = require('@playwright/test');
const { t } = require('./helpers/locale');

// This file intentionally does NOT set a default storageState — auth.setup.js
// seeds a buddgy_onboarding_override for the shared user/admin storageState
// files so the rest of the suite never sees this modal (see its comment).
// This spec needs a genuinely fresh user, with no override yet, so the
// modal is guaranteed to open — same reasoning as auth.spec.js's
// "registers a new user" test, which stops at the URL assertion and never
// exercises the wizard itself.
test('completes the onboarding wizard after first registration', async ({ page }) => {
  const email = `e2e-onboarding-${Date.now()}@buddgy.com`;

  await page.goto('/register');
  await page.getByLabel(t.auth.emailLabel).fill(email);
  await page.getByLabel(new RegExp(`^${t.auth.passwordLabel}`)).fill('password123');
  await page.getByLabel(t.auth.register.confirmPasswordLabel).fill('password123');
  await page.getByRole('button', { name: t.auth.register.submit }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: t.onboarding.title })).toBeVisible();

  // Income step: keep the default "primary salary" row, just fill an amount.
  await modal.getByLabel(t.onboarding.income.amountLabel).fill('12000');
  await modal.getByRole('button', { name: t.onboarding.income.continue }).click();

  // Categories step: pick two suggestions and finish.
  const housingLabel = t.onboarding.categories.suggestions.housing.label;
  const transportLabel = t.onboarding.categories.suggestions.transport;
  await modal.getByLabel(housingLabel, { exact: true }).check();
  await modal.getByLabel(transportLabel, { exact: true }).check();
  await modal.getByRole('button', { name: t.onboarding.categories.finish }).click();

  // Finishing calls a real income replace + real category creates, then
  // falls back to the local override on the (expected) 404 from the
  // completion PATCH — see auth.setup.js's comment. Either way the modal
  // must close and the chosen categories must show up as envelope cards.
  await expect(modal).toBeHidden();
  await expect(page.getByText(housingLabel, { exact: true })).toBeVisible();
  await expect(page.getByText(transportLabel, { exact: true })).toBeVisible();

  // Reload to prove the override persisted — the wizard must not reopen.
  await page.reload();
  await expect(page.getByRole('heading', { name: t.onboarding.title })).toBeHidden();
});
