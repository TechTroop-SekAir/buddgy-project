'use strict';

const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const adminCategoriesController = require('../controllers/adminCategoriesController');

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const createBodySchema = z.object({
  name_he: z.string().trim().min(1).max(80),
  name_en: z.string().trim().min(1).max(80),
  color: z.string().regex(HEX_COLOR_RE).optional(),
  is_active: z.boolean().optional(),
});
// docs/API.md specifies PUT for /api/admin/categories/:id; same partial-update
// shape as routes/envelopes.js's updateBodySchema so a partial PUT still works.
const updateBodySchema = z
  .object({
    name_he: z.string().trim().min(1).max(80),
    name_en: z.string().trim().min(1).max(80),
    color: z.string().regex(HEX_COLOR_RE),
    is_active: z.boolean(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'validation failed: body' });

// requireAuth + requireAdmin are applied once at the parent router (routes/admin.js).
const router = Router();

router.get('/', asyncHandler(adminCategoriesController.list));
router.post('/', validate(createBodySchema), asyncHandler(adminCategoriesController.create));
router
  .route('/:id')
  .all(validate(idParamsSchema, 'params'))
  .put(validate(updateBodySchema), asyncHandler(adminCategoriesController.update))
  .delete(asyncHandler(adminCategoriesController.remove));

module.exports = router;
