import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { PromptBar } from '../advisor/PromptBar';

// Layout route element wrapping every protected page — see routes.jsx.
// docs/DASHBOARD-REDESIGN.md Step 5. pb-28 keeps the fixed PromptBar from
// covering the last row of page content — docs/features/AGENTS.md § Agent 1.
export function AppShellLayout() {
  return (
    <div className="min-h-screen bg-bg-page font-sans text-text-primary">
      <AppHeader />
      <main className="mx-auto max-w-screen-xl px-6 pb-28 pt-8">
        <Outlet />
      </main>
      <PromptBar />
    </div>
  );
}
