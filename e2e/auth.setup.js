// @ts-check
const { test: setup, expect } = require('@playwright/test');
const path = require('path');
const { t } = require('./helpers/locale');
const { API_BASE_URL } = require('./helpers/env');

const USER_FILE = path.join(__dirname, '.auth', 'user.json');
const ADMIN_FILE = path.join(__dirname, '.auth', 'admin.json');

// Runs once before the rest of the suite (see the `setup` project + its
// `chromium` dependency in playwright.config.js) — logs in through the real
// UI once per role and saves storageState, so every other spec starts
// already authenticated instead of re-running the login form each time.
// The login flow itself is still exercised fresh in auth.spec.js.
//
// OnboardingWizardModal (client/src/pages/DashboardPage.jsx) opens whenever
// user.onboarding_completed_at is missing. Its non-dismissible overlay would
// otherwise intercept pointer events on every other spec's first dashboard
// interaction (e.g. auth.spec.js's logout test). Call the real
// PATCH /api/auth/onboarding endpoint directly (bypassing the wizard UI) so
// every spec that reuses this storageState starts past onboarding. The
// wizard itself is exercised fresh, through the real UI, in onboarding.spec.js.
async function markOnboardingComplete(page) {
  const token = await page.evaluate(() => localStorage.getItem('buddgy_token'));
  if (!token) return;
  const res = await page.request.patch(`${API_BASE_URL}/auth/onboarding`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBe(true);
}

async function loginAndSave(page, email, password, storageStatePath) {
  await page.goto('/login');
  await page.getByLabel(t.auth.emailLabel).fill(email);
  await page.getByLabel(t.auth.passwordLabel).fill(password);
  await page.getByRole('button', { name: t.auth.login.submit }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await markOnboardingComplete(page);
  // The dashboard already fetched `user` (and its now-stale
  // onboarding_completed_at: null) before markOnboardingComplete ran —
  // reload so the page re-fetches /auth/me and the wizard actually closes
  // before storageState is captured.
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.context().storageState({ path: storageStatePath });
}

setup('authenticate as regular user', async ({ page }) => {
  await loginAndSave(page, 'test@buddgy.com', 'password123', USER_FILE);
});

setup('authenticate as admin', async ({ page }) => {
  await loginAndSave(page, 'admin@buddgy.com', 'password123', ADMIN_FILE);
});
