import api from './api';
import * as mockTransactionService from './mockTransactionService';

// Real implementation. GET /api/transactions doesn't exist on the server yet
// (server/routes/transactions.js only has /parse — B-05's CRUD isn't built),
// so these calls will 404 until that ticket lands — matches
// envelopeService.js's mock/real switcher shape.
async function list(userId, month) {
  return api.get('/transactions', { params: { month } });
}

const realTransactionService = { list };

const transactionService =
  import.meta.env.VITE_USE_MOCK_API === 'true' ? mockTransactionService : realTransactionService;

export default transactionService;
