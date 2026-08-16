import api from './api';

// "Category" here is a frontend/UX rename of what the backend still calls an
// "envelope" — same /api/envelopes resource (server/routes/envelopes.js),
// unchanged to avoid touching the DB table/model/routes. This service is the
// mapping boundary: it talks envelope-shaped HTTP to the server while
// everything above it (components, pages, query keys) speaks "category".
// Don't rename these paths — a separate, unrelated "category" concept
// already exists server-side as the admin global category catalog (see
// docs/PLAN.md ticket B-06/B-08, /api/admin/categories) and mounting this at
// /api/categories would collide with it.
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

const categoryService = { list, create, update, remove };

export default categoryService;
