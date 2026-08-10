'use strict';

const { Router } = require('express');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { requireAuth } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const googleCalendarService = require('../services/googleCalendarService');
const { syncPlannedExpenses } = require('../services/calendarSyncService');

// Short-lived — only needs to survive the round trip through Google's
// consent screen.
const STATE_TOKEN_EXPIRY = '10m';

// --- Unauthed sub-router -----------------------------------------------
// Google redirects the *browser* here with no Authorization header, so
// requireAuth can never run on this route. Identity instead comes from the
// signed `state` param minted in /connect below.
const publicRouter = Router();

publicRouter.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, state } = req.query;
    const clientUrl = process.env.CLIENT_URL;

    let userId;
    try {
      ({ sub: userId } = jwt.verify(state, process.env.JWT_SECRET));
    } catch {
      return res.redirect(`${clientUrl}/settings?calendar=error`);
    }

    try {
      const tokens = await googleCalendarService.getTokensFromCode(code);
      await googleCalendarService.saveRefreshToken(userId, tokens);
    } catch {
      return res.redirect(`${clientUrl}/settings?calendar=error`);
    }

    // A user is looking at this in a browser tab — never return JSON here.
    return res.redirect(`${clientUrl}/settings?calendar=connected`);
  })
);

// --- Authed sub-router ---------------------------------------------------
const authedRouter = Router();
authedRouter.use(requireAuth);

authedRouter.get(
  '/connect',
  asyncHandler(async (req, res) => {
    const state = jwt.sign({ sub: req.user.id }, process.env.JWT_SECRET, {
      expiresIn: STATE_TOKEN_EXPIRY,
    });
    const authUrl = googleCalendarService.getAuthUrl(state);

    return ok(res, { url: authUrl });
  })
);

authedRouter.post(
  '/sync',
  asyncHandler(async (req, res) => {
    const result = await syncPlannedExpenses(req.user.id);
    return ok(res, result);
  })
);

authedRouter.delete(
  '/disconnect',
  asyncHandler(async (req, res) => {
    await googleCalendarService.clearRefreshToken(req.user.id);
    // planned_expenses rows are kept as a historical record — docs/INTEGRATIONS.md.
    return ok(res, { connected: false });
  })
);

const router = Router();
router.use(publicRouter);
router.use(authedRouter);

module.exports = router;
