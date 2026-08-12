import api from './api';
import * as mockTransactionService from './mockTransactionService';

// Real implementation. GET/POST /api/transactions don't exist on the server
// yet (server/routes/transactions.js only has /parse — B-05's CRUD isn't
// built), so `list`/`create` will 404 until that ticket lands — matches
// envelopeService.js's mock/real switcher shape. `parse` is live today
// (ticket C-02).
async function list(userId, month) {
  return api.get('/transactions', { params: { month } });
}

// text: string (free-form quick-entry input). Server derives the user from
// the JWT — see docs/API.md § AI Quick Entry.
async function parse(text) {
  return api.post('/transactions/parse', { text });
}

// userId is accepted (not sent) for signature parity with the mock, which
// needs it to persist the row — matches list()'s existing convention.
async function create(userId, payload) {
  return api.post('/transactions', payload);
}

const realTransactionService = { list, parse, create };

const transactionService =
  import.meta.env.VITE_USE_MOCK_API === 'true' ? mockTransactionService : realTransactionService;

export default transactionService;
