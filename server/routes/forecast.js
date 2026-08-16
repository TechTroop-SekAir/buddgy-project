'use strict';

const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const forecastController = require('../controllers/forecastController');

const MONTH_RE = /^\d{4}-\d{2}(-\d{2})?$/;
const listQuerySchema = z.object({ month: z.string().regex(MONTH_RE, 'invalid month') });

// Auth applied at the router level, not ad-hoc per route — CLAUDE.md § Non-Negotiables.
const router = Router();
router.use(requireAuth);

router.get('/', validate(listQuerySchema, 'query'), asyncHandler(forecastController.get));

module.exports = router;
