import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import he from './locales/he.json';
import en from './locales/en.json';

// Hebrew is the product default (client/CLAUDE.md § i18n & RTL). English is
// the only other supported locale for now; add more resources here as they
// land rather than introducing a second init path.
export const LOCALE_DIRECTIONS = { he: 'rtl', en: 'ltr' };
export const DEFAULT_LOCALE = 'he';

i18next.use(initReactI18next).init({
  resources: {
    he: { translation: he },
    en: { translation: en },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes output
  returnEmptyString: false,
});

export default i18next;
