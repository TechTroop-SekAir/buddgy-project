import api from './api';
import * as mockPlannedExpenseService from './mockPlannedExpenseService';

// GET /api/planned-expenses?month= and PATCH /api/planned-expenses/:id are
// documented in docs/API.md § Calendar & Forecast but do not exist server-
// side yet (flagged in docs/PLAN.md as an unowned gap next to A-12/B-07).
// This calls them anyway, matching the documented contract exactly, so it
// starts working the moment they land — same posture as
// transactionService.js took toward B-05 before C-08 shipped it.
async function list(userId, month) {
  return api.get('/planned-expenses', { params: { month } });
}

async function update(id, payload) {
  return api.patch(`/planned-expenses/${id}`, payload);
}

const realPlannedExpenseService = { list, update };

const plannedExpenseService =
  import.meta.env.VITE_USE_MOCK_API === 'true' ? mockPlannedExpenseService : realPlannedExpenseService;

export default plannedExpenseService;
