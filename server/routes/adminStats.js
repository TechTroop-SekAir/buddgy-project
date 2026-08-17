'use strict';

const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const adminStatsController = require('../controllers/adminStatsController');

// requireAuth + requireAdmin are applied once at the parent router (routes/admin.js).
const router = Router();

router.get('/', asyncHandler(adminStatsController.get));

module.exports = router;
