import i18n from '../i18n';

// Maps the active i18next language to a BCP-47 Intl locale tag. Only 'he' is
// wired up today, but this is the one place a second locale gets added later
// — money.js/date.js never need to change.
const INTL_LOCALES = {
  he: 'he-IL',
};

export function getIntlLocale() {
  return INTL_LOCALES[i18n.language] ?? 'he-IL';
}
