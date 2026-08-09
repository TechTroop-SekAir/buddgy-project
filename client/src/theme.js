import { createTheme } from '@mantine/core';

// Mantine theme fed from the same CSS custom properties as Tailwind —
// styles/tokens.css is the single source of truth (CLAUDE.md § Non-Negotiables).
// Imported only from components/ui/ and main.jsx.
const readToken = (name) =>
  typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : '';

export const theme = createTheme({
  primaryColor: 'buddgyAccent',
  colors: {
    // Mantine wants a 10-shade array; a flat single-token fill is enough
    // for Day 1 — refine with a real shade scale as part of ticket A-01.
    buddgyAccent: Array(10).fill(readToken('--accent') || '#3d6bf0'),
  },
  fontFamily: 'system-ui, -apple-system, sans-serif',
});
