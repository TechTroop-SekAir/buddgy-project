import axios from 'axios';

export const TOKEN_KEY = 'buddgy_token';

// Every feature service builds on this. Attaches the JWT, and unwraps the
// { data, error } envelope (CLAUDE.md § API Design Rules) so callers only
// ever see `data` — a non-null `error` is thrown as a normal JS Error.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    // docs/STATE.md § Auth State: a 401 from any request clears auth state
    // and redirects to login, handled once here rather than per call-site.
    // Narrowed to the literal "unauthorized" message — the calendar routes
    // (server/routes/calendar.js) also return 401 for "Google Calendar is
    // not connected." / "...access was revoked.", which must NOT log the
    // user out of Buddgy (docs/INTEGRATIONS.md § Failure Handling: prompt
    // to reconnect, don't silently fail the whole session).
    if (error.response?.status === 401 && error.response?.data?.error === 'unauthorized') {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    const message = error.response?.data?.error || error.message || 'Request failed.';
    const rejected = new Error(message);
    // Lets a caller distinguish "route doesn't exist yet" (404) from a real
    // failure — see DashboardPage.jsx's onboardingMutation for why this
    // matters (backend endpoints not shipped yet, mustn't hard-fail the UI).
    rejected.status = error.response?.status;
    return Promise.reject(rejected);
  }
);

export default client;
