'use strict';

const { ok } = require('../utils/respond');
const plannedExpenseService = require('../services/plannedExpenseService');

async function create(req, res) {
  const plannedExpense = await plannedExpenseService.create(req.user.id, req.body);
  return ok(res, plannedExpense, 201);
}

async function list(req, res) {
  const plannedExpenses = await plannedExpenseService.list(req.user.id, req.query.month);
  return ok(res, plannedExpenses);
}

async function update(req, res) {
  const plannedExpense = await plannedExpenseService.update(req.user.id, req.params.id, req.body);
  return ok(res, plannedExpense);
}

async function remove(req, res) {
  const result = await plannedExpenseService.remove(req.user.id, req.params.id);
  return ok(res, result);
}

module.exports = { create, list, update, remove };
