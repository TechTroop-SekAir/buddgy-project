'use strict';

const { ok } = require('../utils/respond');
const categoryService = require('../services/categoryService');

async function list(req, res) {
  const categories = await categoryService.list();
  return ok(res, categories);
}

async function create(req, res) {
  const category = await categoryService.create(req.body);
  return ok(res, category, 201);
}

async function update(req, res) {
  const category = await categoryService.update(req.params.id, req.body);
  return ok(res, category);
}

async function remove(req, res) {
  const result = await categoryService.remove(req.params.id);
  return ok(res, result);
}

module.exports = { list, create, update, remove };
