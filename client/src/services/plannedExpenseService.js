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

// Its own VITE_USE_MOCK_PLANNED_EXPENSES flag, independent of
// VITE_USE_MOCK_CALENDAR — planned-expense CRUD isn't a Google API call, so
// it stays real even when Calendar OAuth is mocked (docs/TESTING.md §
// Mocking Policy only names Google Calendar and Claude as mockable). This
// used to share calendarService.js's flag so mockCalendarService.js's
// sync()-seeded rows would show up here, but that meant e2e's calendar mock
// silently mocked planned-expense confirm too — see e2e/planned-expenses.spec.js,
// which needs the real create/update endpoints to assert on the transaction
// and envelope-spent effects of confirming.
const plannedExpenseService =
  import.meta.env.VITE_USE_MOCK_PLANNED_EXPENSES === 'true' ? mockPlannedExpenseService : realPlannedExpenseService;

export default plannedExpenseService;
