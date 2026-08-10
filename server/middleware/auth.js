'use strict';

const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

// Verifies the JWT and attaches req.user. Applied at the router level per
// CLAUDE.md § Non-Negotiables — never ad-hoc per route.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError('unauthorized', 401));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
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
