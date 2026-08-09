import { createContext, useContext, useMemo, useState } from 'react';

// Minimal auth state — token + user, backed by localStorage. Feature
// services read the token via services/api.js's interceptor, not from here
// directly. Expanded as auth endpoints land (ticket A-04).
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = ({ token, user: nextUser }) => {
    localStorage.setItem('buddgy_token', token);
    setUser(nextUser);
  };

  const logout = () => {
    localStorage.removeItem('buddgy_token');
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
