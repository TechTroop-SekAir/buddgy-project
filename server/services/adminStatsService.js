'use strict';

// Usage stats for the admin panel (docs/API.md § Admin, /api/admin/stats).
const { User, Transaction, AiCall } = require('../models');

async function get() {
  const [userCount, transactionCount, aiCallCount] = await Promise.all([
    User.count(),
    Transaction.count(),
    AiCall.count(),
  ]);
  return { userCount, transactionCount, aiCallCount };
}

module.exports = { get };
