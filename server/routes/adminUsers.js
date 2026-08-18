'use strict';

const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const adminUsersController = require('../controllers/adminUsersController');

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const setDisabledBodySchema = z.object({ disabled: z.boolean() });

// requireAuth + requireAdmin are applied once at the parent router (routes/admin.js).
const router = Router();

router.get('/', asyncHandler(adminUsersController.list));
router
  .route('/:id')
  .all(validate(idParamsSchema, 'params'))
  .patch(validate(setDisabledBodySchema), asyncHandler(adminUsersController.setDisabled));

module.exports = router;
