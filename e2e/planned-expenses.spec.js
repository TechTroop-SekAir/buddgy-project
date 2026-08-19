// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { t } = require('./helpers/locale');

test.use({ storageState: path.join(__dirname, '.auth', 'user.json') });

// Planned expense confirm (qa.md § E2E Tests): add -> confirm -> transaction
// + envelope spent. Runs against the real backend end to end
// (VITE_USE_MOCK_PLANNED_EXPENSES=false in playwright.config.js) — see
// server/services/plannedExpenseService.js's update(), which atomically
// creates a linked Transaction on confirm so envelope spent_agorot (computed
// live from transactions, not stored) reflects it. Calendar OAuth mocking
// (e2e/calendar-sync.spec.js) is independent of this and doesn't seed real
// planned-expense rows, so this spec creates its own via the manual "Add"
// form on the Planned Expenses page.
test('confirming a planned expense creates a transaction and updates envelope spent', async ({ page }) => {
  const envelopeName = `E2E Envelope ${Date.now()}`;
  const expenseTitle = `E2E Expense ${Date.now()}`;
  // Every planned expense recurs monthly from today through this end date
  // (PlannedExpenseFormModal.jsx) — set to today so exactly one row (this
  // month's) is created, matching this test's single-confirm assertion below.
  const endDate = new Date().toISOString().slice(0, 10);

  // Create an envelope to attach the planned expense to.
  await page.goto('/dashboard');
  const addTrigger = page
    .getByRole('button', { name: t.dashboard.addFirstCategory })
    .or(page.getByRole('button', { name: t.dashboard.addCategory }));
  await addTrigger.click();

  const addCategoryDialog = page.getByRole('dialog');
  await expect(addCategoryDialog.getByRole('heading', { name: t.addCategoryModal.title })).toBeVisible();
  await addCategoryDialog.getByLabel(t.addCategoryModal.nameLabel).fill(envelopeName);
  await addCategoryDialog.getByLabel(t.addCategoryModal.budgetLabel).fill('2000');
  await addCategoryDialog.getByRole('button', { name: t.addCategoryModal.submit }).click();
  await expect(addCategoryDialog).toBeHidden();

  // Add a manual planned expense against that envelope.
  await page.goto('/planned-expenses');
  await page.getByRole('button', { name: t.plannedExpenses.addButton }).click();

  const addExpenseDialog = page.getByRole('dialog');
  await expect(addExpenseDialog.getByRole('heading', { name: t.addPlannedExpenseModal.title })).toBeVisible();
  await addExpenseDialog.getByLabel(t.addPlannedExpenseModal.titleLabel).fill(expenseTitle);
  await addExpenseDialog.getByLabel(t.addPlannedExpenseModal.amountLabel).fill('250');
  await addExpenseDialog.locator('#planned-expense-end-date').fill(endDate);
  await addExpenseDialog.getByRole('textbox', { name: t.addPlannedExpenseModal.envelopeLabel }).click();
  await page.getByRole('option', { name: envelopeName, exact: true }).click();
  await addExpenseDialog.getByRole('button', { name: t.addPlannedExpenseModal.submit }).click();
  await expect(addExpenseDialog).toBeHidden();

  const row = page.locator('tr', { has: page.getByText(expenseTitle, { exact: true }) });
  await expect(row).toBeVisible();
  const confirmButton = row.getByRole('button', { name: t.plannedExpenses.confirm });
  await expect(confirmButton).toBeVisible();

  await confirmButton.click();

  // Row now shows the "confirmed" badge instead of a clickable button.
  await expect(row.getByRole('button', { name: t.plannedExpenses.confirm })).toHaveCount(0);
  await expect(row.getByText(t.plannedExpenses.confirm, { exact: true })).toBeVisible();

  // Envelope spent reflects the real linked transaction (server/services/
  // plannedExpenseService.js's update()) — not just a UI-local optimistic
  // change. Matched on digits only, same reasoning as envelopes.spec.js.
  await page.goto('/dashboard');
  const card = page.locator('div', { has: page.getByText(envelopeName, { exact: true }) }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText(/250/).first()).toBeVisible();

  // And the transaction itself is visible on the Transactions page.
  await page.goto('/transactions');
  await expect(page.getByText(expenseTitle, { exact: true })).toBeVisible();
});
