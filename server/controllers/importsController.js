'use strict';

const { ok } = require('../utils/respond');
const AppError = require('../utils/AppError');
const csvImportService = require('../services/csvImportService');

async function preview(req, res) {
  if (!req.file) {
    throw new AppError('validation failed: file', 400);
  }

  const result = await csvImportService.previewImport(req.user.id, req.file);
  return ok(res, result);
}

async function confirm(req, res) {
  const importId = Number(req.params.id);
  if (!Number.isInteger(importId)) {
    throw new AppError('validation failed: id', 400);
  }

  const { mapping } = req.body || {};
  const result = await csvImportService.confirmImport(req.user.id, importId, mapping);
  return ok(res, result);
}

module.exports = { preview, confirm };
