import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';

// Layout route element wrapping every protected page — see routes.jsx.
// docs/DASHBOARD-REDESIGN.md Step 5.
export function AppShellLayout() {
  return (
    <div className="min-h-screen bg-bg-page font-sans text-text-primary">
      <AppHeader />
      <main className="mx-auto max-w-screen-xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
