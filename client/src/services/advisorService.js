import api from './api';

// POST /api/advisor/ask — docs/features/AGENTS.md § Agent 1 (Budget Advisor).
// `history` is this chat session's prior turns, client-state-only — never
// persisted, cleared on refresh/new session (useAdvisorPrompt.js owns it).
async function ask(text, history = []) {
  return api.post('/advisor/ask', { text, history });
}

const advisorService = { ask };
export default advisorService;
