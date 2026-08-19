import api from './api';
import * as mockIncomeService from './mockIncomeService';

// Backend routes for this resource may not exist yet — the client is built
// to the agreed contract ahead of the backend shipping it. A 404 here isn't
// a real failure, so each function falls back to the mock (localStorage)
// implementation instead of surfacing an error to the caller.
async function list(userId, month) {
  try {
    return await api.get('/income-sources', { params: { month } });
  } catch (err) {
    if (err.status !== 404) throw err;
    return mockIncomeService.list(userId, month);
  }
}

async function replace(userId, month, rows) {
  try {
    return await api.put('/income-sources', { month, rows });
  } catch (err) {
    if (err.status !== 404) throw err;
    return mockIncomeService.replace(userId, month, rows);
  }
}

const realIncomeService = { list, replace };

// Same flag authService.js uses — flip VITE_USE_MOCK_API to swap both at once.
const incomeService =
  import.meta.env.VITE_USE_MOCK_API === 'true' ? mockIncomeService : realIncomeService;

export default incomeService;
