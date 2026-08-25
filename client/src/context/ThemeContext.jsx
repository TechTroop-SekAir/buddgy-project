import { createContext, useContext, useMemo, useState } from 'react';
import { THEME_KEY } from '../constants/storageKeys';

// The single place that touches document.documentElement's data-theme
// attribute — components never set it themselves. Switching `mode` here is
// the only thing a theme toggle UI needs to call. Mirrors LocaleContext.jsx's
// shape/placement; see applyMode below for the one deliberate deviation.
const ThemeContext = createContext(null);

function resolveInitialMode() {
  // index.html runs an inline script before React mounts that already reads
  // localStorage and sets this attribute, specifically to avoid a flash of
  // the wrong theme on load — read it back here rather than re-deriving the
  // same value a second time.
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme) {
    return document.documentElement.dataset.theme;
  }
  if (typeof window === 'undefined') return 'light';
  // Light is the hard default — no prefers-color-scheme fallback. Dark mode
  // is reachable only via an explicit in-app toggle.
  return localStorage.getItem(THEME_KEY) || 'light';
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

  // Discards the stored preference entirely (not just setting mode to
  // 'light') so a subsequent logout->login cycle starts light too, rather
  // than restoring whatever was cleared. Called on logout — see
  // AuthContext.jsx.
  const resetTheme = () => {
    localStorage.removeItem(THEME_KEY);
    document.documentElement.dataset.theme = 'light';
    setMode('light');
  };

  const value = useMemo(() => ({ mode, setMode: applyMode, resetTheme }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
