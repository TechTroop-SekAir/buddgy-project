'use strict';

// Centralized error middleware — CLAUDE.md § Error Handling.
// Every async route is wrapped (utils/asyncHandler.js) so all rejections
// land here. Never leaks a stack trace to the client.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.isAppError ? err.statusCode : 500;
  const message = err.isAppError ? err.message : 'Something went wrong. Please try again.';

  // Full context server-side only.
  console.error(`[${req.method} ${req.originalUrl}]`, err);

  res.status(statusCode).json({ data: null, error: message });
}

module.exports = errorHandler;
