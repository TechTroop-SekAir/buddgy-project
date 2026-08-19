// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { t } = require('./helpers/locale');

test.use({ storageState: path.join(__dirname, '.auth', 'user.json') });

// CSV Import (qa.md § E2E Tests): upload -> confirm detected column mapping
// -> bulk import -> duplicates skipped on re-upload. Column *detection*
// itself is Claude-backed, which this suite deliberately breaks (invalid
// ANTHROPIC_API_KEY, per docs/TESTING.md's Mocking Policy) — so this
// exercises the manual-mapping fallback path, not AI detection. That
// fallback only works because of the previewImport fix made alongside this
// spec (server/services/csvImportService.js now uploads before calling
// Claude, so a Claude failure still yields a usable importId).
//
// Content is generated per run (not a static fixture) so re-running the
// suite against the same buddgy_e2e database doesn't collide with a
// previous run's dedup_hash rows — that's exactly the no-op behavior being
// tested for *within* one run (the re-upload below), not something a
// second, unrelated run should trip over.
// TransactionsPage defaults to the current month (useMonth()) — dates must
// fall within it or the imported rows are invisible on the default view.
function buildCsv(suffix) {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return [
    'Date,Amount,Description',
    `${monthPrefix}-01,42.50,E2E Import Row A ${suffix}`,
    `${monthPrefix}-02,18.00,E2E Import Row B ${suffix}`,
  ].join('\n');
}

async function uploadAndMapManually(page, csvContent) {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'sample-import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvContent),
  });
  await page.getByRole('button', { name: t.csvImport.select.submit }).click();

  await expect(page.getByText(t.csvImport.error.aiFailed)).toBeVisible();

  // getByLabel would also match the (also aria-labelledby'd) listbox popup
  // Mantine's Select renders once open — getByRole('textbox', ...) scopes
  // to just the input itself.
  await page.getByRole('textbox', { name: t.csvImport.mapping.dateLabel }).click();
  await page.getByRole('option', { name: 'Date', exact: true }).click();
  await page.getByRole('textbox', { name: t.csvImport.mapping.amountLabel }).click();
  await page.getByRole('option', { name: 'Amount', exact: true }).click();
  await page.getByRole('textbox', { name: t.csvImport.mapping.descriptionLabel }).click();
  await page.getByRole('option', { name: 'Description', exact: true }).click();

  await page.getByRole('button', { name: t.csvImport.mapping.confirm }).click();
  // done.title is a plain <p>, not a heading element — match on text.
  await expect(page.getByText(t.csvImport.done.title)).toBeVisible();
}

test('imports a CSV via manual column mapping, then skips duplicates on re-upload', async ({ page }) => {
  const suffix = Date.now();
  const rowA = `E2E Import Row A ${suffix}`;
  const rowB = `E2E Import Row B ${suffix}`;
  const csvContent = buildCsv(suffix);

  await page.goto('/imports');
  await uploadAndMapManually(page, csvContent);

  // Verify against real imported data rather than the done-screen's summary
  // sentence — that sentence is pluralized per-locale (docs/TESTING.md's
  // he.json defines only _one/_other, not _two, so i18next's Hebrew CLDR
  // "two" category for a count of 2 falls through to the English fallback
  // resource entirely — a real i18n bug, out of scope for this ticket, but
  // reason enough not to assert on that string here).
  await page.getByRole('link', { name: t.csvImport.done.viewTransactions }).click();
  await expect(page.getByText(rowA, { exact: true })).toBeVisible();
  await expect(page.getByText(rowB, { exact: true })).toBeVisible();

  // Buddgy-critical case (docs/TESTING.md): re-importing the same file is a
  // no-op for already-imported rows, via the dedup_hash unique constraint.
  await page.goto('/imports');
  await uploadAndMapManually(page, csvContent);
  await page.getByRole('link', { name: t.csvImport.done.viewTransactions }).click();
  await expect(page.getByText(rowA, { exact: true })).toHaveCount(1);
  await expect(page.getByText(rowB, { exact: true })).toHaveCount(1);
});
