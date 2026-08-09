'use strict';

const { Router } = require('express');
const { ok } = require('../utils/respond');

const router = Router();

// Unauthenticated — target for Railway's healthcheck (docs/DEPLOYMENT.md § Smoke Checks).
router.get('/health', (req, res) => ok(res, { ok: true }));

// Feature routers mount here as they're built, e.g.:
// router.use('/auth', require('./authRoutes'));
// router.use('/envelopes', require('./envelopeRoutes'));

module.exports = router;
