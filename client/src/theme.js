import { createTheme } from '@mantine/core';

// Mantine theme fed from the same CSS custom properties as Tailwind —
// styles/tokens.css is the single source of truth (CLAUDE.md § Non-Negotiables).
// Imported only from components/ui/ and main.jsx.
const readToken = (name) =>
  typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : '';

export const theme = createTheme({
  // Key must be 'accent' to match docs/design.md's documented usage
  // (`color="accent"` on every Button/component call site) — a mismatched
  // key here leaves Mantine unable to resolve a color, rendering filled
  // buttons with no visible background/text.
  primaryColor: 'accent',
  colors: {
    // Mantine wants a 10-shade array; a flat single-token fill is enough
    // for Day 1 — refine with a real shade scale as part of ticket A-01.
    accent: Array(10).fill(readToken('--accent') || '#3d6bf0'),
    'status-ok': Array(10).fill(readToken('--status-ok') || '#2f9e58'),
    'status-warning': Array(10).fill(readToken('--status-warning') || '#d98c1f'),
    // 90–99%-used envelope tier (docs/DASHBOARD-REDESIGN.md Step 3) —
    // distinct from status-danger so overBudget still reads as more severe.
    'status-critical': Array(10).fill(readToken('--status-critical') || '#b45309'),
    'status-danger': Array(10).fill(readToken('--status-danger') || '#d9483a'),
    // Forecast banner only (docs/DESIGN.md § Status Colors) — never used for
    // individual envelope status, which stays on status-ok/warning/critical/danger.
    'status-forecast-alert': Array(10).fill(readToken('--status-forecast-alert') || '#b5350f'),
  },
  // Note: the bright status-*-fill tokens (bars/chips) are intentionally
  // absent here — nothing Mantine-rendered should use them as a color prop.
  fontFamily: readToken('--font-sans') || 'system-ui, -apple-system, sans-serif',
  fontFamilyMonospace: readToken('--font-mono') || 'ui-monospace, monospace',
  defaultRadius: 'md',
  radius: {
    sm: readToken('--radius-sm') || '0.5rem',
    md: readToken('--radius-md') || '0.75rem',
    lg: readToken('--radius-lg') || '1rem',
  },
  shadows: {
    sm: readToken('--shadow-sm'),
    md: readToken('--shadow-md'),
    lg: readToken('--shadow-lg'),
  },
});
