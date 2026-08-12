'use strict';

const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const transactionsController = require('../controllers/transactionsController');

const MONTH_RE = /^\d{4}-\d{2}(-\d{2})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const listQuerySchema = z.object({
  month: z.string().regex(MONTH_RE, 'invalid month'),
  envelopeId: z.coerce.number().int().positive().optional(),
});
const createBodySchema = z.object({
  envelope_id: z.number().int().positive().nullable().optional(),
  amount_agorot: z.number().int().positive(),
  description: z.string().trim().min(1).max(255),
  transaction_date: z.string().regex(DATE_RE, 'invalid date'),
  // 'csv' is written only by csvImportService.js's bulk path, never this route.
  source: z.enum(['manual', 'quick_entry']).optional(),
});
const updateBodySchema = z
  .object({
    envelope_id: z.number().int().positive().nullable(),
    amount_agorot: z.number().int().positive(),
    description: z.string().trim().min(1).max(255),
    transaction_date: z.string().regex(DATE_RE, 'invalid date'),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'validation failed: body' });

// Auth applied at the router level, not ad-hoc per route — CLAUDE.md § Non-Negotiables.
// Note: this file also becomes home to Matan's transaction CRUD (B-05) — only
// /parse belongs to C-02.
const router = Router();
router.use(requireAuth);

router.post('/parse', asyncHandler(transactionsController.parse));

router.get('/', validate(listQuerySchema, 'query'), asyncHandler(transactionsController.list));
router.post('/', validate(createBodySchema), asyncHandler(transactionsController.create));
router
  .route('/:id')
  .all(validate(idParamsSchema, 'params'))
  .patch(validate(updateBodySchema), asyncHandler(transactionsController.update))
  .delete(asyncHandler(transactionsController.remove));

module.exports = router;
