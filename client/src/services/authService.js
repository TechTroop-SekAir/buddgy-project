import api from './api';
import * as mockAuthService from './mockAuthService';

// Real implementation, matching docs/API.md's Auth contract. api.js's
// response interceptor already unwraps the { data, error } envelope, so
// these resolve directly to { token, user } / { user }.
async function register({ email, password }) {
  return api.post('/auth/register', { email, password });
}

async function login({ email, password }) {
  return api.post('/auth/login', { email, password });
}

async function me() {
  return api.get('/auth/me');
}

const realAuthService = { register, login, me };

// VITE_USE_MOCK_API gates which implementation callers get — AuthContext and
// the auth pages only ever call `authService.*` and never know which one is
// active. Ticket A-09 flips the flag (and can delete mockAuthService.js).
const authService =
  import.meta.env.VITE_USE_MOCK_API === 'true' ? mockAuthService : realAuthService;

export default authService;
