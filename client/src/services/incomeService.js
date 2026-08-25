import api from './api';
import * as mockIncomeService from './mockIncomeService';

// Real implementation, backed by server/routes/income.js. api.js's response
// interceptor already unwraps the { data, error } envelope, so these
// resolve directly to { rows, total_agorot } — plus `carried_from` when
// `fallback` is passed (Settings' income editor; see incomeSourceService.js
// on the server). DashboardPage calls list() without a fallback and keeps
// getting the plain shape.
async function list(userId, month, fallback) {
  return api.get('/income-sources', { params: { month, fallback } });
}

async function replace(userId, month, rows) {
  return api.put('/income-sources', { month, rows });
}

const realIncomeService = { list, replace };

// Same flag authService.js uses — flip VITE_USE_MOCK_API to swap both at once.
const incomeService =
  import.meta.env.VITE_USE_MOCK_API === 'true' ? mockIncomeService : realIncomeService;

export default incomeService;
