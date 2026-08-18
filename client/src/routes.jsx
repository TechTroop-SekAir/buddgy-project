import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Skeleton } from './components/ui';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ImportPage } from './pages/ImportPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlannedExpensesPage } from './pages/PlannedExpensesPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

// Public/protected split per ticket A-02. Feature pages (categories,
// transactions, quick entry, calendar, admin) get their own
// routes as their tickets land — this is the skeleton, not the full map.
//
// Session rehydration from the stored token — brief, but a bare blank screen
// during it reads as broken rather than loading (client/CLAUDE.md's Async UX
// Contract: content-shaped wait -> Skeleton).
function RouteLoading() {
  return (
    <div className="p-8">
      <Skeleton height={32} width={200} radius="sm" />
    </div>
  );
}

// Both gates wait on isLoading so a refreshed session isn't bounced before
// AuthContext finishes rehydrating the user from the stored token.
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <RouteLoading />;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicOnlyRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <RouteLoading />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

// Nested inside ProtectedRoute (ticket A-14), so an unauthenticated visit to
// /admin still lands on /login rather than /dashboard. Authenticated
// non-admins are redirected to /dashboard, not /login — they're just not
// authorized, not unauthenticated.
function AdminRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <RouteLoading />;
  return user?.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <TransactionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/imports"
        element={
          <ProtectedRoute>
            <ImportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/planned-expenses"
        element={
          <ProtectedRoute>
            <PlannedExpensesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
