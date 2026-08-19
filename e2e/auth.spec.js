// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { t } = require('./helpers/locale');

const USER_FILE = path.join(__dirname, '.auth', 'user.json');
const ADMIN_FILE = path.join(__dirname, '.auth', 'admin.json');

// This file intentionally does NOT set a default storageState (unlike every
// other spec) — it's testing the login/register/logout/redirect flows
// themselves, which need to start from a genuinely unauthenticated context.

test.describe('unauthenticated', () => {
  test('registers a new user and lands on the dashboard', async ({ page }) => {
    const email = `e2e-${Date.now()}@buddgy.com`;

    await page.goto('/register');
    await page.getByLabel(t.auth.emailLabel).fill(email);
    // Plain getByLabel(passwordLabel) would also match the confirm-password
    // field, since "אימות סיסמה" contains "סיסמה" as a substring — anchor
    // instead of relying on `exact` (Mantine's required-field asterisk
    // markup makes the exact accessible name harder to predict).
    await page.getByLabel(new RegExp(`^${t.auth.passwordLabel}`)).fill('password123');
    await page.getByLabel(t.auth.register.confirmPasswordLabel).fill('password123');
    await page.getByRole('button', { name: t.auth.register.submit }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('logs in with the seeded user account', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(t.auth.emailLabel).fill('test@buddgy.com');
    await page.getByLabel(t.auth.passwordLabel).fill('password123');
    await page.getByRole('button', { name: t.auth.login.submit }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('logs in as admin', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(t.auth.emailLabel).fill('admin@buddgy.com');
    await page.getByLabel(t.auth.passwordLabel).fill('password123');
    await page.getByRole('button', { name: t.auth.login.submit }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('redirects a protected route to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('defaults to Hebrew and right-to-left', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.getByRole('heading', { name: t.auth.login.title })).toBeVisible();
  });
});

test.describe('logout', () => {
  test.use({ storageState: USER_FILE });

  test('logs out and can no longer reach a protected route', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: t.nav.profileMenu }).click();
    await page.getByRole('menuitem', { name: t.nav.logout }).click();

    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('admin route authorization', () => {
  test('non-admin visiting /admin is redirected to the dashboard', async ({ browser }) => {
    const context = await browser.newContext({ storageState: USER_FILE });
    const page = await context.newPage();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard$/);
    await context.close();
  });

  test('admin can reach /admin', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_FILE });
    const page = await context.newPage();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin$/);
    await context.close();
  });
});
