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

const calendarService =
  import.meta.env.VITE_USE_MOCK_API === 'true' ? mockCalendarService : realCalendarService;

export default calendarService;
