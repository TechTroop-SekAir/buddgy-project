'use strict';

const authService = require('../services/authService');
const { ok } = require('../utils/respond');

async function register(req, res) {
  const result = await authService.register(req.body || {});
  return ok(res, result, 201);
}

async function login(req, res) {
  const result = await authService.login(req.body || {});
  return ok(res, result);
}

async function me(req, res) {
  const user = await authService.findUserById(req.user.id);
  return ok(res, { user });
}

module.exports = { register, login, me };
