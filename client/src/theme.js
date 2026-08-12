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
    'status-danger': Array(10).fill(readToken('--status-danger') || '#d9483a'),
  },
  fontFamily: 'system-ui, -apple-system, sans-serif',
});
