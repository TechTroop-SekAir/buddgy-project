'use strict';

// The API response envelope mandated by CLAUDE.md § API Design Rules.
// Controllers should always go through this rather than hand-writing
// { data, error } — keeps the shape consistent everywhere.
const ok = (res, data, status = 200) => res.status(status).json({ data, error: null });

module.exports = { ok };
