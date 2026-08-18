import api from './api';

async function list(userId, month) {
  return api.get('/transactions', { params: { month } });
}

// text: string (free-form quick-entry input). Server derives the user from
// the JWT — see docs/API.md § AI Quick Entry.
async function parse(text) {
  return api.post('/transactions/parse', { text });
}

// userId is accepted (not sent) for signature parity with list() — the
// server derives the user from the JWT.
async function create(userId, payload) {
  return api.post('/transactions', payload);
}

async function update(id, payload) {
  return api.patch(`/transactions/${id}`, payload);
}

async function remove(id) {
  return api.delete(`/transactions/${id}`);
}

const transactionService = { list, parse, create, update, remove };

export default transactionService;
