'use strict';

const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Auth + role check applied once for every admin sub-resource — CLAUDE.md §
// Non-Negotiables ("auth middleware applied at the router level, not ad-hoc
// per route"). /users and /stats (B-08) mount here alongside /categories.
const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

router.use('/categories', require('./adminCategories'));
router.use('/users', require('./adminUsers'));
router.use('/stats', require('./adminStats'));

module.exports = router;
