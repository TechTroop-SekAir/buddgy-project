import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, LOCALE_DIRECTIONS } from '../i18n';

// The single place that touches `document.documentElement.lang`/`dir`
// (client/CLAUDE.md § i18n & RTL) — components never set direction
// themselves. Switching `locale` here is the only thing a locale switcher
// UI needs to call.
const LocaleContext = createContext(null);

const LOCALE_KEY = 'buddgy_locale';

export function LocaleProvider({ children }) {
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState(() => localStorage.getItem(LOCALE_KEY) || DEFAULT_LOCALE);

  const direction = LOCALE_DIRECTIONS[locale] || 'ltr';

  useEffect(() => {
    i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    localStorage.setItem(LOCALE_KEY, locale);
  }, [locale, direction, i18n]);

  const value = useMemo(() => ({ locale, direction, setLocale }), [locale, direction]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
