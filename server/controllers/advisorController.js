'use strict';

const { ok } = require('../utils/respond');
const advisorService = require('../services/advisorService');

async function ask(req, res) {
  const { text } = req.body;
  const result = await advisorService.ask(req.user.id, text);
  return ok(res, result);
}

module.exports = { ask };
