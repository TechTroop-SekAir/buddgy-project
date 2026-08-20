import api from './api';
import * as mockIncomeService from './mockIncomeService';

// Real implementation, backed by server/routes/income.js. api.js's response
// interceptor already unwraps the { data, error } envelope, so these
// resolve directly to { rows, total_agorot }.
async function list(userId, month) {
  return api.get('/income-sources', { params: { month } });
}

async function replace(userId, month, rows) {
  return api.put('/income-sources', { month, rows });
}

const realIncomeService = { list, replace };

// Same flag authService.js uses — flip VITE_USE_MOCK_API to swap both at once.
const incomeService =
  import.meta.env.VITE_USE_MOCK_API === 'true' ? mockIncomeService : realIncomeService;

export default incomeService;
