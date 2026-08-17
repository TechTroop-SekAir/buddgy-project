import api from './api';
import mockForecastService from './mockForecastService';

// GET /api/forecast?month= is documented in docs/API.md § Calendar & Forecast
// but does not exist server-side yet — no /forecast route is registered in
// server/routes/index.js (ticket B-07, unshipped). Unlike
// plannedExpenseService.js/calendarService.js/importService.js, whose real
// endpoints already exist and work, calling this one would just 404 for
// every dev regardless of VITE_USE_MOCK_API (which is committed as `false`
// in client/.env now that envelopes/transactions/planned-expenses are real).
// So this falls back to the mock unconditionally, not gated on the flag, to
// avoid that 404. Swap the export back to the commented-out toggle below
// once B-07 ships.
async function get(userId, month) {
  return api.get('/forecast', { params: { month } });
}

const realForecastService = { get };

// const forecastService =
//   import.meta.env.VITE_USE_MOCK_API === 'true' ? mockForecastService : realForecastService;
const forecastService = mockForecastService;

export default forecastService;
