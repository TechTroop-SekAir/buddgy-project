'use strict';

const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const incomeController = require('../controllers/incomeController');

const MONTH_RE = /^\d{4}-\d{2}(-\d{2})?$/;

const listQuerySchema = z.object({
  month: z.string().regex(MONTH_RE, 'invalid month'),
  // Settings' income editor passes this so a month with no rows yet is
  // prefilled from the most recent earlier month instead of showing empty —
  // see incomeSourceService.list. Omitted entirely by DashboardPage's plain
  // read, which must keep showing a real ₪0 for an unfilled month.
  fallback: z.enum(['previous']).optional(),
});
// Full-month replace (client/src/services/mockIncomeService.js's contract) —
// user_id is derived from the JWT, never client-writable; sort_order is
// server-assigned from array position, not accepted from the client.
const replaceBodySchema = z.object({
  month: z.string().regex(MONTH_RE, 'invalid month'),
  rows: z.array(
    z.object({
      label: z.string().trim().min(1).max(80),
      amount_agorot: z.number().int().positive(),
    })
  ),
});

// Auth applied at the router level, not ad-hoc per route — CLAUDE.md § Non-Negotiables.
const router = Router();
router.use(requireAuth);

router.get('/', validate(listQuerySchema, 'query'), asyncHandler(incomeController.list));
router.put('/', validate(replaceBodySchema), asyncHandler(incomeController.replace));

module.exports = router;
