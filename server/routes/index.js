'use strict';

const { Router } = require('express');
const { ok } = require('../utils/respond');

const router = Router();

// Unauthenticated — target for Railway's healthcheck (docs/DEPLOYMENT.md § Smoke Checks).
router.get('/health', (req, res) => ok(res, { ok: true }));

router.use('/auth', require('./authRoutes'));
router.use('/envelopes', require('./envelopes'));
router.use('/transactions', require('./transactions'));
router.use('/calendar', require('./calendar'));
router.use('/imports', require('./imports'));
router.use('/planned-expenses', require('./plannedExpenses'));

module.exports = router;
