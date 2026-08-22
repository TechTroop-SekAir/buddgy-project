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
  //
  // The whole card body is itself a `role="button"` (CategoryCard.jsx) that
  // opens the spending-details drawer, with an aria-label interpolated with
  // `name` — a stable, unique locator without needing to walk the DOM.
  const card = page.getByRole('button', { name: interpolate(t.categoryManagement.openDetails, { name }) });
  const cardMenuButton = page.getByRole('button', { name: interpolate(t.categoryManagement.cardMenu, { name }) });
  await expect(card).toBeVisible();
  await expect(card.getByText(/1,000/).first()).toBeVisible();

  // Edit budget via the "..." menu's Edit item (docs/features/HOMEPAGE-FIXES.md
  // § 3.2 — Edit used to be a standalone button next to the menu).
  await cardMenuButton.click();
  await page.getByRole('menuitem', { name: t.common.edit }).click();

  const editDialog = page.getByRole('dialog');
  await expect(editDialog.getByRole('heading', { name: t.editCategoryModal.title })).toBeVisible();
  // § 3.1 — editing selects the prefilled amount, so a plain fill() (which
  // replaces the input's current value outright) doubles as proof the field
  // isn't being appended to.
  await editDialog.getByLabel(t.addCategoryModal.budgetLabel).fill('1500');
  await editDialog.getByRole('button', { name: t.editCategoryModal.submit }).click();
  await expect(editDialog).toBeHidden();
  await expect(card.getByText(/1,500/).first()).toBeVisible();

  // Spending details drawer (§ 3.3): clicking the card body (not the menu)
  // opens a read-only drawer of this month's transactions for the envelope.
  // A freshly created envelope has none, so the empty state must render.
  await card.click();
  const drawer = page.getByRole('dialog').filter({ hasText: name });
  await expect(drawer.getByRole('heading', { name })).toBeVisible();
  await expect(drawer.getByText(t.categoryDetailsDrawer.empty)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();

  // Delete via the shared ConfirmDeleteModal.
  await cardMenuButton.click();
  await page.getByRole('menuitem', { name: t.common.delete }).click();

  const confirmDialog = page.getByRole('dialog');
  await expect(confirmDialog.getByRole('heading', { name: t.categoryManagement.deleteConfirmTitle })).toBeVisible();
  await confirmDialog.getByRole('button', { name: t.common.delete }).click();
  await expect(confirmDialog).toBeHidden();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
});

// § 3.4 — unique category names, surfaced as an inline field error rather
// than a generic failure banner.
test('rejects creating a category with a name already used this month', async ({ page }) => {
  const name = `E2E Duplicate ${Date.now()}`;

  await page.goto('/dashboard');

  const addTrigger = page
    .getByRole('button', { name: t.dashboard.addFirstCategory })
    .or(page.getByRole('button', { name: t.dashboard.addCategory }));

  // First category: succeeds.
  await addTrigger.click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel(t.addCategoryModal.nameLabel).fill(name);
  await dialog.getByLabel(t.addCategoryModal.budgetLabel).fill('500');
  await dialog.getByRole('button', { name: t.addCategoryModal.submit }).click();
  await expect(dialog).toBeHidden();

  // Second category with the same name this month: rejected inline, dialog
  // stays open, and nothing new is created.
  await page.getByRole('button', { name: t.dashboard.addCategory }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(t.addCategoryModal.nameLabel).fill(name);
  await dialog.getByLabel(t.addCategoryModal.budgetLabel).fill('750');
  await dialog.getByRole('button', { name: t.addCategoryModal.submit }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(t.addCategoryModal.nameDuplicate)).toBeVisible();
  await dialog.getByRole('button', { name: t.common.cancel }).click();
  await expect(dialog).toBeHidden();

  // Only one card for this name exists — the duplicate was never created.
  const cardMenuButton = page.getByRole('button', { name: interpolate(t.categoryManagement.cardMenu, { name }) });
  await expect(cardMenuButton).toHaveCount(1);

  // Clean up.
  await cardMenuButton.click();
  await page.getByRole('menuitem', { name: t.common.delete }).click();
  const confirmDialog = page.getByRole('dialog');
  await confirmDialog.getByRole('button', { name: t.common.delete }).click();
  await expect(confirmDialog).toBeHidden();
});
