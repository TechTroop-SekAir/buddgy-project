import api from './api';
import * as mockPlannedExpenseService from './mockPlannedExpenseService';

// GET /api/planned-expenses?month= and PATCH /api/planned-expenses/:id are
// real and working server-side (ticket A-20: server/routes/plannedExpenses.js).
// includeDismissed (ticket C-14) opts into rows the user dismissed from
// Upcoming Events ("this won't cost money") — off by default so the main
// table and the card's primary list never show them.
async function list(userId, month, { includeDismissed = false } = {}) {
  return api.get('/planned-expenses', {
    params: { month, ...(includeDismissed ? { include_dismissed: true } : {}) },
  });
}

async function update(id, payload) {
  return api.patch(`/planned-expenses/${id}`, payload);
}

async function create(userId, payload) {
  return api.post('/planned-expenses', payload);
}

async function remove(id) {
  return api.delete(`/planned-expenses/${id}`);
}

const realPlannedExpenseService = { list, update, create, remove };

// Paired with calendarService.js on the same VITE_USE_MOCK_CALENDAR flag
// (not the global VITE_USE_MOCK_API — see calendarService.js's comment for
// why): mockCalendarService.js's sync() writes rows into the
// buddgy_mock_planned_expenses localStorage key, and only
// mockPlannedExpenseService.js reads from it. If this stayed on the real
// branch while calendarService.js went mock, synced rows would never show
// up on the Planned Expenses page.
const plannedExpenseService =
  import.meta.env.VITE_USE_MOCK_CALENDAR === 'true' ? mockPlannedExpenseService : realPlannedExpenseService;

export default plannedExpenseService;
