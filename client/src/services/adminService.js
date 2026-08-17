import api from './api';

// Wraps /api/admin, gated server-side by requireAuth + requireAdmin
// (server/routes/admin.js). Categories CRUD is live today; users/stats are
// ticket B-08 — see docs/API.md § Admin for the documented contracts these
// calls target.
const adminService = {
  categories: {
    list: () => api.get('/admin/categories'),
    create: (payload) => api.post('/admin/categories', payload),
    update: (id, payload) => api.put(`/admin/categories/${id}`, payload),
    remove: (id) => api.delete(`/admin/categories/${id}`),
  },
  users: {
    list: () => api.get('/admin/users'),
    setDisabled: (id, disabled) => api.patch(`/admin/users/${id}`, { disabled }),
  },
  stats: {
    get: () => api.get('/admin/stats'),
  },
};

export default adminService;
