import { useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DirectionProvider, MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildTheme } from './theme';
import { AuthProvider } from './context/AuthContext';
import { LocaleProvider, useLocale } from './context/LocaleContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { MonthProvider } from './context/MonthContext';
import { AppRoutes } from './routes';

const queryClient = new QueryClient();

// Mantine's direction lives above MantineProvider and must react to the
// active locale, so it reads `useLocale()` — hence this inner shell nested
// under LocaleProvider rather than folded into App() directly.
function AppShell() {
  const { direction } = useLocale();
  const { mode } = useTheme();
  // Rebuilt whenever `mode` changes: buildTheme() reads CSS custom
  // properties off document.documentElement, and ThemeContext guarantees
  // data-theme is already flipped (synchronously, before this render) by
  // the time this runs — see ThemeContext.jsx's applyMode.
  const theme = useMemo(() => buildTheme(), [mode]);

  return (
    // Keyed on direction: DirectionProvider only reacts to its
    // `initialDirection` prop on mount, so a locale switch needs a fresh
    // instance to actually flip Mantine's RTL behavior.
    <DirectionProvider key={direction} initialDirection={direction} detectDirection={false}>
      <MantineProvider theme={theme} forceColorScheme={mode}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </MantineProvider>
    </DirectionProvider>
  );
}

export default function App() {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MonthProvider>
              <AppShell />
            </MonthProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
