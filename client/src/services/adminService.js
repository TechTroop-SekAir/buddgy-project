import api from './api';

// Wraps /api/admin, gated server-side by requireAuth + requireAdmin
// (server/routes/admin.js). See docs/API.md § Admin for the documented
// contracts these calls target.
const adminService = {
  users: {
    list: () => api.get('/admin/users'),
    setDisabled: (id, disabled) => api.patch(`/admin/users/${id}`, { disabled }),
  },
  stats: {
    get: () => api.get('/admin/stats'),
  },
};

export default adminService;
