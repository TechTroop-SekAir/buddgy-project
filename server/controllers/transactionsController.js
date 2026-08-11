'use strict';

const { Envelope } = require('../models');
const AppError = require('../utils/AppError');
const { ok } = require('../utils/respond');
const claudeService = require('../services/claudeService');

const MAX_QUICK_ENTRY_TEXT_LENGTH = 500;

async function parse(req, res) {
  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim() || text.length > MAX_QUICK_ENTRY_TEXT_LENGTH) {
    throw new AppError('validation failed: text', 400);
  }

  const envelopes = await Envelope.findAll({
    where: { user_id: req.user.id },
    attributes: ['id', 'name'],
  });

  const result = await claudeService.parseQuickEntry(text.trim(), envelopes);
  return ok(res, result);
}

module.exports = { parse };
