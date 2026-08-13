// Maps the seeded mock envelope/category names (see mockEnvelopeService.js's
// DEFAULT_ENVELOPES) to translated labels. Real user-entered envelope names
// fall through untranslated — this only covers the known demo set.
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
