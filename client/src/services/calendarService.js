import api from './api';
import * as mockCalendarService from './mockCalendarService';

// Real implementation, matching docs/API.md § Calendar & Forecast /
// server/routes/calendar.js exactly (ticket C-05/C-06, both done). userId is
// accepted-but-ignored on every fn for call-site parity with the mock,
// which needs it (real endpoints derive the caller from the JWT).
async function getConnectUrl(userId) {
  return api.get('/calendar/connect');
}

async function sync(userId) {
  return api.post('/calendar/sync');
}

async function disconnect(userId) {
  return api.delete('/calendar/disconnect');
}

const realCalendarService = { getConnectUrl, sync, disconnect };

// Gated on its own VITE_USE_MOCK_CALENDAR flag rather than the global
// VITE_USE_MOCK_API — flipping the global flag also switches authService.js
// to mockAuthService, which issues a fake token that the always-real
// categoryService.js/transactionService.js would get a 401 on. This lets a
// real, logged-in dev exercise Settings → Connect → Sync without live
// Google OAuth creds. plannedExpenseService.js now has its own independent
// mock flag (VITE_USE_MOCK_PLANNED_EXPENSES) — set that one too if you also
// want mockCalendarService.js's synced rows to show up on the Planned
// Expenses page instead of just this page's connected/sync-result state.
const calendarService =
  import.meta.env.VITE_USE_MOCK_CALENDAR === 'true' ? mockCalendarService : realCalendarService;

export default calendarService;
