import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ImportPage } from './pages/ImportPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlannedExpensesPage } from './pages/PlannedExpensesPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

// Public/protected split per ticket A-02. Feature pages (envelopes,
// transactions, quick entry, calendar, admin) get their own
// routes as their tickets land — this is the skeleton, not the full map.
//
// Both gates wait on isLoading so a refreshed session isn't bounced before
// AuthContext finishes rehydrating the user from the stored token.
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicOnlyRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
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
    </Routes>
  );
}
