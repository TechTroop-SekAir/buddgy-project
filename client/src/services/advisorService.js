import api from './api';

// POST /api/advisor/ask — docs/features/AGENTS.md § Agent 1 (Budget Advisor).
// Transport only: server/services/advisorService.js currently returns a
// placeholder verdict until A-21 lands the real tool-use loop.
async function ask(text) {
  return api.post('/advisor/ask', { text });
}

const advisorService = { ask };

export default advisorService;
