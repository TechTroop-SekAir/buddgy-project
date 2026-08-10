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
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    const message = error.response?.data?.error || error.message || 'Request failed.';
    return Promise.reject(new Error(message));
  }
);

export default client;
