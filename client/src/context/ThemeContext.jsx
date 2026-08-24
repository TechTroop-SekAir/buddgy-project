import { createContext, useContext, useMemo, useState } from 'react';

// The single place that touches document.documentElement's data-theme
// attribute — components never set it themselves. Switching `mode` here is
// the only thing a theme toggle UI needs to call. Mirrors LocaleContext.jsx's
// shape/placement; see applyMode below for the one deliberate deviation.
const ThemeContext = createContext(null);

const THEME_KEY = 'buddgy_theme'; // must match the inline script in index.html — keep both in sync

function resolveInitialMode() {
  // index.html runs an inline script before React mounts that already reads
  // localStorage/prefers-color-scheme and sets this attribute, specifically
  // to avoid a flash of the wrong theme on load — read it back here rather
  // than re-deriving the same value a second time.
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme) {
    return document.documentElement.dataset.theme;
  }
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(resolveInitialMode);

  // Deliberately NOT a useEffect, unlike LocaleContext's lang/dir sync:
  // src/theme.js's buildTheme() does a synchronous JS read of computed CSS
  // values to build the Mantine theme object. React finishes all
  // render-phase work (including every descendant's useMemo) before any
  // effect runs, so if data-theme were flipped inside an effect, the
  // same-commit theme rebuild would still see the *previous* CSS values —
  // one commit stale. Writing the attribute synchronously here, before
  // setMode schedules a re-render, avoids that race entirely.
  const applyMode = (next) => {
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    setMode(next);
  };

  const value = useMemo(() => ({ mode, setMode: applyMode }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
