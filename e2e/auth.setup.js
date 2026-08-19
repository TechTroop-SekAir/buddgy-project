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
async function loginAndSave(page, email, password, storageStatePath) {
  await page.goto('/login');
  await page.getByLabel(t.auth.emailLabel).fill(email);
  await page.getByLabel(t.auth.passwordLabel).fill(password);
  await page.getByRole('button', { name: t.auth.login.submit }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.context().storageState({ path: storageStatePath });
}

setup('authenticate as regular user', async ({ page }) => {
  await loginAndSave(page, 'test@buddgy.com', 'password123', USER_FILE);
});

setup('authenticate as admin', async ({ page }) => {
  await loginAndSave(page, 'admin@buddgy.com', 'password123', ADMIN_FILE);
});
