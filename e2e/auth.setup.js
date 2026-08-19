// @ts-check
const { test: setup, expect } = require('@playwright/test');
const path = require('path');
const { t } = require('./helpers/locale');

const USER_FILE = path.join(__dirname, '.auth', 'user.json');
const ADMIN_FILE = path.join(__dirname, '.auth', 'admin.json');

// Runs once before the rest of the suite (see the `setup` project + its
// `chromium` dependency in playwright.config.js) — logs in through the real
// UI once per role and saves storageState, so every other spec starts
// already authenticated instead of re-running the login form each time.
// The login flow itself is still exercised fresh in auth.spec.js.
//
// OnboardingWizardModal (client/src/pages/DashboardPage.jsx) opens whenever
// user.onboarding_completed_at is missing — which it always is, since the
// backend hasn't shipped that column/route yet (see
// client/src/utils/onboardingOverride.js). Its non-dismissible overlay would
// otherwise intercept pointer events on every other spec's first dashboard
// interaction (e.g. auth.spec.js's logout test). Seed the same
// per-user-id localStorage override the app's own 404-fallback path writes,
// so every spec that reuses this storageState starts past onboarding. The
// wizard itself is exercised fresh, without this override, in
// onboarding.spec.js.
async function markOnboardingComplete(page) {
  await page.evaluate(() => {
    const token = localStorage.getItem('buddgy_token');
    if (!token) return;
    const payload = JSON.parse(atob(token.split('.')[1]));
    const KEY = 'buddgy_onboarding_override';
    const raw = localStorage.getItem(KEY);
    const overrides = raw ? JSON.parse(raw) : {};
    overrides[payload.sub] = true;
    localStorage.setItem(KEY, JSON.stringify(overrides));
  });
}

async function loginAndSave(page, email, password, storageStatePath) {
  await page.goto('/login');
  await page.getByLabel(t.auth.emailLabel).fill(email);
  await page.getByLabel(t.auth.passwordLabel).fill(password);
  await page.getByRole('button', { name: t.auth.login.submit }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await markOnboardingComplete(page);
  await page.context().storageState({ path: storageStatePath });
}

setup('authenticate as regular user', async ({ page }) => {
  await loginAndSave(page, 'test@buddgy.com', 'password123', USER_FILE);
});

setup('authenticate as admin', async ({ page }) => {
  await loginAndSave(page, 'admin@buddgy.com', 'password123', ADMIN_FILE);
});
