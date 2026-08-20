'use strict';

const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const advisorController = require('../controllers/advisorController');

// Matches quick-entry's MAX_QUICK_ENTRY_TEXT_LENGTH (server/controllers/transactionsController.js).
const askBodySchema = z.object({ text: z.string().trim().min(1).max(500) });

// Router-level requireAuth + a real validate() entry — docs/features/AGENTS.md
// explicitly calls out /transactions/parse's inline validation as a deviation
// not to copy here.
const router = Router();
router.use(requireAuth);

router.post('/ask', validate(askBodySchema), asyncHandler(advisorController.ask));

module.exports = router;
