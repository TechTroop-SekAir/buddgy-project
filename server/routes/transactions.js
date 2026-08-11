'use strict';

const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const transactionsController = require('../controllers/transactionsController');

// Auth applied at the router level, not ad-hoc per route — CLAUDE.md § Non-Negotiables.
// Note: this file also becomes home to Matan's transaction CRUD (B-05) — only
// /parse belongs to C-02.
const router = Router();
router.use(requireAuth);

router.post('/parse', asyncHandler(transactionsController.parse));

module.exports = router;
