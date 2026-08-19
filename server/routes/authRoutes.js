'use strict';

const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = Router();

router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.get('/me', requireAuth, asyncHandler(authController.me));
router.patch('/onboarding', requireAuth, asyncHandler(authController.completeOnboarding));

module.exports = router;
