import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService';
import { TOKEN_KEY } from '../services/api';

// Auth state — token + user, backed by localStorage per docs/STATE.md §
// Auth State. On mount, an existing token is rehydrated into `user` via
// authService.me() so a page refresh doesn't silently lose the session.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    authService
      .me()
      .then(({ user: rehydratedUser }) => setUser(rehydratedUser))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setIsLoading(false));
  }, []);

  const login = ({ token, user: nextUser }) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(nextUser);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  // Re-fetches the current user without a full page reload — needed after
  // calendar connect/disconnect (ticket A-12) so `user.connected` reflects
  // the server without forcing a logout/login cycle.
  const refreshUser = async () => {
    const { user: refreshedUser } = await authService.me();
    setUser(refreshedUser);
    return refreshedUser;
  };

  const value = useMemo(() => ({ user, isLoading, login, logout, refreshUser }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
