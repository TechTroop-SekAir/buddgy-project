'use strict';

// Thrown from services/controllers to signal an intentional, client-safe
// failure (validation, not-found, auth, conflict). Anything else that
// throws is treated as an unexpected 500 by errorHandler.js.
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isAppError = true;
  }
}

module.exports = AppError;
