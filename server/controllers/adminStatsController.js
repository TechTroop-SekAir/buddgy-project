'use strict';

const { ok } = require('../utils/respond');
const adminStatsService = require('../services/adminStatsService');

async function get(req, res) {
  const stats = await adminStatsService.get();
  return ok(res, stats);
}

module.exports = { get };
