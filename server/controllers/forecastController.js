'use strict';

const { ok } = require('../utils/respond');
const forecastService = require('../services/forecastService');

async function get(req, res) {
  const forecast = await forecastService.get(req.user.id, req.query.month);
  return ok(res, forecast);
}

module.exports = { get };
