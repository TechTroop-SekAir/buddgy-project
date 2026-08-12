import api from './api';
import * as mockImportService from './mockImportService';

// userId: the real endpoint derives the caller from the JWT and takes no such
// param, but the mock needs it to scope stored parses/rows per user — same
// (file, userId) / (importId, mapping, userId) call site as the real
// service, which simply ignores the extra argument. Mirrors
// transactionService.parse's userId quirk.
async function preview(file, userId) {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/imports/preview', formData);
}

async function confirm(importId, mapping, userId) {
  return api.post(`/imports/${importId}/confirm`, { mapping });
}

const realImportService = { preview, confirm };

const importService =
  import.meta.env.VITE_USE_MOCK_API === 'true' ? mockImportService : realImportService;

export default importService;
