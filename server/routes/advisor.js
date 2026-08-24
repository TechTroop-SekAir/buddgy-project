'use strict';

const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const advisorController = require('../controllers/advisorController');

// Matches quick-entry's MAX_QUICK_ENTRY_TEXT_LENGTH (server/controllers/transactionsController.js).
// history: client-side-only conversation history (docs/features/AGENTS.md §
// Agent 1) — never persisted server-side, just prepended to this call's
// model conversation so a same-session follow-up ("how did you calculate
// that?") has context. Capped so an unbounded client array can't inflate
// token spend on every call — must match MAX_HISTORY_TURNS in
// client/src/hooks/useAdvisorPrompt.js.
const MAX_HISTORY_TURNS = 10;
const historyItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(1000),
});
const askBodySchema = z.object({
  text: z.string().trim().min(1).max(500),
  history: z.array(historyItemSchema).max(MAX_HISTORY_TURNS).optional().default([]),
});

// Router-level requireAuth + a real validate() entry — docs/features/AGENTS.md
// explicitly calls out /transactions/parse's inline validation as a deviation
// not to copy here.
const router = Router();
router.use(requireAuth);

router.post('/ask', validate(askBodySchema), asyncHandler(advisorController.ask));

module.exports = router;
