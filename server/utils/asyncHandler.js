'use strict';

// Wraps an async route handler so a rejected promise reaches the centralized
// error middleware instead of crashing the process. CLAUDE.md § Non-Negotiables:
// "All async route handlers wrapped in try/catch (or an async wrapper utility)".
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
