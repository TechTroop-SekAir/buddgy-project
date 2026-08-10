'use strict';

const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const googleCalendarService = require('../services/googleCalendarService');

const router = Router();

router.get(
  '/connect',
  asyncHandler(async (req, res) => {
    const authUrl = googleCalendarService.getAuthUrl();
    
    return ok(res, { url: authUrl });
  })
);

router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code } = req.query;

    const tokens = await googleCalendarService.getTokensFromCode(code);

    // TODO: בשלב הבא (C-06) נשמור את ה-tokens.refresh_token מוצפן
    // בטבלת users בעמודה google_refresh_token עבור המשתמש המחובר

    return ok(res, {
      connected: true,
      hasRefreshToken: Boolean(tokens.refresh_token),
    });
  })
);

module.exports = router;