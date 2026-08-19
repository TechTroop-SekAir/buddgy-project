'use strict';

const { ok } = require('../utils/respond');
const incomeSourceService = require('../services/incomeSourceService');

async function list(req, res) {
  const result = await incomeSourceService.list(req.user.id, req.query.month);
  return ok(res, result);
}

async function replace(req, res) {
  const result = await incomeSourceService.replace(req.user.id, req.body.month, req.body.rows);
  return ok(res, result);
}

module.exports = { list, replace };
