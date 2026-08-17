'use strict';

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const AppError = require('../utils/AppError');

// Verifies the JWT and attaches req.user. Applied at the router level per
// CLAUDE.md § Non-Negotiables — never ad-hoc per route.
//
// Looks the user up on every request (not just at login) so a B-08 admin
// disabling an account, or changing its role, takes effect immediately
// instead of waiting out the JWT's 7-day TTL (docs/SECURITY.md § JWT
// Lifecycle) — req.user is built from this DB row, not the JWT claim.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError('unauthorized', 401));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.sub, { attributes: ['id', 'role', 'disabled'] });
    if (!user || user.disabled) {
      return next(new AppError('unauthorized', 401));
    }
    req.user = { id: user.id, role: user.role };
    next();
  } catch {
    next(new AppError('unauthorized', 401));
  }
}

// Stack after requireAuth on admin-only routes.
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(new AppError('forbidden', 403));
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
