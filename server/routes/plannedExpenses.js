'use strict';

const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const plannedExpensesController = require('../controllers/plannedExpensesController');

const MONTH_RE = /^\d{4}-\d{2}(-\d{2})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const listQuerySchema = z.object({ month: z.string().regex(MONTH_RE, 'invalid month') });
// google_event_id and user_id are never client-writable — google_event_id is
// sync-owned (server/services/calendarSyncService.js UPSERTs it), user_id is
// derived from the JWT.
const updateBodySchema = z
  .object({
    envelope_id: z.number().int().positive().nullable(),
    title: z.string().trim().min(1).max(160),
    amount_agorot: z.number().int().positive(),
    due_date: z.string().regex(DATE_RE, 'invalid date'),
    is_confirmed: z.boolean(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'validation failed: body' });

// Auth applied at the router level, not ad-hoc per route — CLAUDE.md § Non-Negotiables.
const router = Router();
router.use(requireAuth);

router.get('/', validate(listQuerySchema, 'query'), asyncHandler(plannedExpensesController.list));
router
  .route('/:id')
  .all(validate(idParamsSchema, 'params'))
  .patch(validate(updateBodySchema), asyncHandler(plannedExpensesController.update));

module.exports = router;
