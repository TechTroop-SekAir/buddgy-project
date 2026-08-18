'use strict';

const { ok } = require('../utils/respond');
const adminUserService = require('../services/adminUserService');

async function list(req, res) {
  const users = await adminUserService.list();
  return ok(res, users);
}

async function setDisabled(req, res) {
  const result = await adminUserService.setDisabled(req.user.id, req.params.id, req.body.disabled);
  return ok(res, result);
}

module.exports = { list, setDisabled };
