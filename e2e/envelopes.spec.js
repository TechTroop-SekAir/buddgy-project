// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { t, interpolate } = require('./helpers/locale');

test.use({ storageState: path.join(__dirname, '.auth', 'user.json') });

// Envelope CRUD (qa.md § E2E Tests): create -> edit budget -> view -> delete.
// "Category" in the UI is the server's "envelope" resource — see
// client/src/services/categoryService.js's header comment.
test('create, edit, view, and delete an envelope', async ({ page }) => {
  const name = `E2E Envelope ${Date.now()}`;

  await page.goto('/dashboard');

  // Either the empty-state CTA or the regular "add category" button is
  // visible depending on whether earlier envelopes already exist for this
  // month — this test cleans up after itself, but stays robust either way.
  const addTrigger = page
    .getByRole('button', { name: t.dashboard.addFirstCategory })
    .or(page.getByRole('button', { name: t.dashboard.addCategory }));
  await addTrigger.click();

  const addDialog = page.getByRole('dialog');
  await expect(addDialog.getByRole('heading', { name: t.addCategoryModal.title })).toBeVisible();
  await addDialog.getByLabel(t.addCategoryModal.nameLabel).fill(name);
  await addDialog.getByLabel(t.addCategoryModal.budgetLabel).fill('1000');
  await addDialog.getByRole('button', { name: t.addCategoryModal.submit }).click();
  await expect(addDialog).toBeHidden();

  // View: the new card renders with its budget. Matched on the digits only
  // (not the full currency-formatted string) since exact symbol/spacing is
  // an Intl.NumberFormat(locale) detail, not what this test is checking.
  const card = page.locator('div', { has: page.getByText(name, { exact: true }) }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText(/1,000/).first()).toBeVisible();

  // Edit budget via the card's per-envelope menu.
  const cardMenuButton = page.getByRole('button', { name: interpolate(t.categoryManagement.cardMenu, { name }) });
  await cardMenuButton.click();
  await page.getByRole('menuitem', { name: t.common.edit }).click();

  const editDialog = page.getByRole('dialog');
  await expect(editDialog.getByRole('heading', { name: t.editCategoryModal.title })).toBeVisible();
  await editDialog.getByLabel(t.addCategoryModal.budgetLabel).fill('1500');
  await editDialog.getByRole('button', { name: t.editCategoryModal.submit }).click();
  await expect(editDialog).toBeHidden();
  await expect(card.getByText(/1,500/).first()).toBeVisible();

  // Delete via the shared ConfirmDeleteModal.
  await cardMenuButton.click();
  await page.getByRole('menuitem', { name: t.common.delete }).click();

  const confirmDialog = page.getByRole('dialog');
  await expect(confirmDialog.getByRole('heading', { name: t.categoryManagement.deleteConfirmTitle })).toBeVisible();
  await confirmDialog.getByRole('button', { name: t.common.delete }).click();
  await expect(confirmDialog).toBeHidden();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
});
