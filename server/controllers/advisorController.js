'use strict';

const { ok } = require('../utils/respond');
const advisorService = require('../services/advisorService');

async function ask(req, res) {
  const { text, history } = req.body;
  const result = await advisorService.ask(req.user.id, text, history);
  return ok(res, result);
}

module.exports = { ask };
