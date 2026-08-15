import api from './api';
import * as mockEnvelopeService from './mockEnvelopeService';

// Real implementation, matching docs/API.md's Envelopes contract — mounted at
// /api/envelopes (server/routes/index.js). Matches authService.js's mock/real
// switcher shape.
async function list(userId, month) {
  return api.get('/envelopes', { params: { month } });
}

async function create(userId, payload) {
  return api.post('/envelopes', payload);
}

async function update(id, payload) {
  return api.patch(`/envelopes/${id}`, payload);
}

async function remove(id) {
  return api.delete(`/envelopes/${id}`);
}

const realEnvelopeService = { list, create, update, remove };

const envelopeService =
  import.meta.env.VITE_USE_MOCK_API === 'true' ? mockEnvelopeService : realEnvelopeService;

export default envelopeService;
