// Maps the seeded demo category names (see categoryService.js's real
// /api/envelopes-backed data) to translated labels. Real user-entered
// category names fall through untranslated — this only covers the known
// demo set. Unrelated to the `categoryManagement.*` i18n namespace used by
// the category create/edit/delete UI (client/src/components/categories/) —
// this file's `categories.*` keys are display-label translations only.
const CATEGORY_KEYS = {
  Housing: 'housing',
  Groceries: 'groceries',
  Utilities: 'utilities',
  Transport: 'transport',
  Healthcare: 'healthcare',
  'Dining Out': 'diningOut',
  Entertainment: 'entertainment',
  Shopping: 'shopping',
};

export function getCategoryLabel(name, t) {
  const key = CATEGORY_KEYS[name];
  return key ? t(`categories.${key}`) : name;
}
