'use strict';

const AppError = require('../utils/AppError');

// First use of zod at the middleware layer — CLAUDE.md § API Design Rules:
// "Input validation happens in middleware, not in controllers." Controllers
// call services with req.body/req.query already coerced and stripped of
// unknown keys by the schema.
//
// @param {import('zod').ZodType} schema
// @param {'body'|'query'|'params'} [source]
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const field = result.error.issues[0]?.path.join('.') || source;
      return next(new AppError(`validation failed: ${field}`, 400));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
