'use strict';

const { ok } = require('../utils/respond');
const plannedExpenseService = require('../services/plannedExpenseService');

async function list(req, res) {
  const plannedExpenses = await plannedExpenseService.list(req.user.id, req.query.month);
  return ok(res, plannedExpenses);
}

async function update(req, res) {
  const plannedExpense = await plannedExpenseService.update(req.user.id, req.params.id, req.body);
  return ok(res, plannedExpense);
}

module.exports = { list, update };
