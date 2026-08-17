'use strict';

const { Envelope } = require('../models');
const AppError = require('../utils/AppError');
const { ok } = require('../utils/respond');
const claudeService = require('../services/claudeService');
const transactionService = require('../services/transactionService');

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

  const result = await claudeService.parseQuickEntry(req.user.id, text.trim(), envelopes);
  return ok(res, result);
}

async function list(req, res) {
  const { month, envelopeId } = req.query;
  const transactions = await transactionService.list(req.user.id, { month, envelopeId });
  return ok(res, transactions);
}

async function create(req, res) {
  const transaction = await transactionService.create(req.user.id, req.body);
  return ok(res, transaction, 201);
}

async function update(req, res) {
  const transaction = await transactionService.update(req.user.id, req.params.id, req.body);
  return ok(res, transaction);
}

async function remove(req, res) {
  const result = await transactionService.remove(req.user.id, req.params.id);
  return ok(res, result);
}

module.exports = { parse, list, create, update, remove };
