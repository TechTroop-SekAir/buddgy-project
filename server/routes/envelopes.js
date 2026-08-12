'use strict';

const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const envelopesController = require('../controllers/envelopesController');

const MONTH_RE = /^\d{4}-\d{2}(-\d{2})?$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const listQuerySchema = z.object({ month: z.string().regex(MONTH_RE, 'invalid month') });
const createBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  monthly_budget_agorot: z.number().int().positive(),
  color: z.string().regex(HEX_COLOR_RE).optional(),
  month: z.string().regex(MONTH_RE, 'invalid month'),
});
// PATCH-shaped even for PUT — envelopeService.js § Design decisions: the
// client (envelopeService.js) sends partial updates via api.patch, docs/API.md
// specifies PUT; both verbs land on the same partial-update handler.
const updateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    monthly_budget_agorot: z.number().int().positive(),
    color: z.string().regex(HEX_COLOR_RE),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'validation failed: body' });

// Auth applied at the router level, not ad-hoc per route — CLAUDE.md § Non-Negotiables.
const router = Router();
router.use(requireAuth);

router.get('/', validate(listQuerySchema, 'query'), asyncHandler(envelopesController.list));
router.post('/', validate(createBodySchema), asyncHandler(envelopesController.create));
router
  .route('/:id')
  .all(validate(idParamsSchema, 'params'))
  .put(validate(updateBodySchema), asyncHandler(envelopesController.update))
  .patch(validate(updateBodySchema), asyncHandler(envelopesController.update))
  .delete(asyncHandler(envelopesController.remove));

module.exports = router;
