import api from './api';

// envelopeId (server/routes/transactions.js) narrows the list to one
// envelope — used by CategoryDetailsDrawer.jsx to show a category's
// transactions without fetching and filtering the whole month client-side.
async function list(userId, month, { envelopeId } = {}) {
  return api.get('/transactions', { params: { month, ...(envelopeId ? { envelopeId } : {}) } });
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
