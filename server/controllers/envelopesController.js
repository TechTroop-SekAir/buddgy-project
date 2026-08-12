'use strict';

const { ok } = require('../utils/respond');
const envelopeService = require('../services/envelopeService');

async function list(req, res) {
  const envelopes = await envelopeService.list(req.user.id, req.query.month);
  return ok(res, envelopes);
}

async function create(req, res) {
  const envelope = await envelopeService.create(req.user.id, req.body);
  return ok(res, envelope, 201);
}

async function update(req, res) {
  const envelope = await envelopeService.update(req.user.id, req.params.id, req.body);
  return ok(res, envelope);
}

async function remove(req, res) {
  const result = await envelopeService.remove(req.user.id, req.params.id);
  return ok(res, result);
}

module.exports = { list, create, update, remove };
