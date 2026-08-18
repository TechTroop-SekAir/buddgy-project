import { BrowserRouter } from 'react-router-dom';
import { DirectionProvider, MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme';
import { AuthProvider } from './context/AuthContext';
import { LocaleProvider, useLocale } from './context/LocaleContext';
import { MonthProvider } from './context/MonthContext';
import { AppRoutes } from './routes';

const queryClient = new QueryClient();

// Mantine's direction lives above MantineProvider and must react to the
// active locale, so it reads `useLocale()` — hence this inner shell nested
// under LocaleProvider rather than folded into App() directly.
function AppShell() {
  const { direction } = useLocale();

  return (
    // Keyed on direction: DirectionProvider only reacts to its
    // `initialDirection` prop on mount, so a locale switch needs a fresh
    // instance to actually flip Mantine's RTL behavior.
    <DirectionProvider key={direction} initialDirection={direction} detectDirection={false}>
      <MantineProvider theme={theme}>
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
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MonthProvider>
            <AppShell />
          </MonthProvider>
        </AuthProvider>
      </QueryClientProvider>
    </LocaleProvider>
  );
}
