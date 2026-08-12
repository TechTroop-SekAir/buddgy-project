import api from './api';
import * as mockEnvelopeService from './mockEnvelopeService';

// Real implementation. No envelopeRoutes.js exists on the server yet
// (server/routes/index.js has it commented out), so these calls will 404
// until that ticket lands — matches authService.js's mock/real switcher shape.
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
