'use strict';

const { google } = require('googleapis');
const { User } = require('../models');
const { encrypt, decrypt } = require('../utils/crypto');
const AppError = require('../utils/AppError');

// docs/INTEGRATIONS.md § Google Calendar API — request the minimum scope
// needed (read-only), never write access to the user's calendar.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// A fresh OAuth2 client per call — never a shared module-level instance.
// The client holds credentials as mutable state, so a singleton would let
// concurrent users' tokens clobber each other.
function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

const getAuthUrl = (state) => {
  const client = createOAuthClient();

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
};

const getTokensFromCode = async (code) => {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
};

// Persists the refresh token, encrypted at rest — docs/SECURITY.md.
const saveRefreshToken = async (userId, tokens) => {
  if (!tokens.refresh_token) {
    // Google omits refresh_token on some re-consents. Writing null over an
    // existing working token would silently break future syncs.
    throw new AppError(
      'Google did not return a refresh token. Revoke Buddgy\'s access at ' +
        'myaccount.google.com/permissions and reconnect.',
      400
    );
  }

  await User.update(
    { google_refresh_token: encrypt(tokens.refresh_token) },
    { where: { id: userId } }
  );
};

const clearRefreshToken = async (userId) => {
  await User.update({ google_refresh_token: null }, { where: { id: userId } });
};

// Builds an OAuth2 client authenticated as the given user, ready for
// calendar API calls. Throws a targeted, client-safe error rather than
// letting a missing/revoked token surface as a raw 500 — docs/INTEGRATIONS.md
// § Failure Handling: a token problem must fail only that action, not the
// whole dashboard.
const getAuthedClient = async (userId) => {
  const user = await User.findByPk(userId, { attributes: ['id', 'google_refresh_token'] });

  if (!user?.google_refresh_token) {
    throw new AppError('Google Calendar is not connected.', 401);
  }

  const refreshToken = decrypt(user.google_refresh_token);
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });

  try {
    // Forces a refresh now so a revoked/expired token fails here with a
    // clear message instead of deep inside a later calendar.events.list call.
    await client.getAccessToken();
  } catch {
    throw new AppError('Google Calendar access was revoked. Please reconnect.', 401);
  }

  return client;
};

module.exports = {
  getAuthUrl,
  getTokensFromCode,
  saveRefreshToken,
  clearRefreshToken,
  getAuthedClient,
};
