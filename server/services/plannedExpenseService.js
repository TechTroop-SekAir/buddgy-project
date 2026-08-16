'use strict';

const { Op } = require('sequelize');
const { PlannedExpense, Envelope } = require('../models');
const AppError = require('../utils/AppError');
const { normalizeMonth } = require('./envelopeService');
const { monthRange } = require('../utils/month');

const PUBLIC_ATTRIBUTES = [
  'id',
  'user_id',
  'envelope_id',
  'title',
  'amount_agorot',
  'due_date',
  'google_event_id',
  'is_confirmed',
];

/** A caller may only ever point a planned expense at their own envelope, or none. */
async function assertEnvelopeOwnership(userId, envelopeId) {
  if (envelopeId === null || envelopeId === undefined) return;
  const envelope = await Envelope.findOne({ where: { id: envelopeId, user_id: userId }, attributes: ['id'] });
  if (!envelope) throw new AppError('validation failed: envelope_id', 400);
}

async function list(userId, monthInput) {
  const month = normalizeMonth(monthInput);
  const { from, to } = monthRange(month);

  const plannedExpenses = await PlannedExpense.findAll({
    where: { user_id: userId, due_date: { [Op.between]: [from, to] } },
    attributes: PUBLIC_ATTRIBUTES,
    order: [['due_date', 'ASC'], ['id', 'ASC']],
  });
  return plannedExpenses.map((p) => p.get({ plain: true }));
}

/** Owner-scoped lookup shared by update — 404, never 403, on a foreign id (docs/SECURITY.md § Row-Level Access). */
async function findOwned(userId, id) {
  const plannedExpense = await PlannedExpense.findOne({ where: { id, user_id: userId }, attributes: PUBLIC_ATTRIBUTES });
  if (!plannedExpense) throw new AppError('not found', 404);
  return plannedExpense;
}

async function update(userId, id, patch) {
  const plannedExpense = await findOwned(userId, id);
  const { envelope_id, title, amount_agorot, due_date, is_confirmed } = patch;

  if (envelope_id !== undefined) await assertEnvelopeOwnership(userId, envelope_id);

  const fields = {};
  if (envelope_id !== undefined) fields.envelope_id = envelope_id;
  if (title !== undefined) fields.title = title;
  if (amount_agorot !== undefined) fields.amount_agorot = amount_agorot;
  if (due_date !== undefined) fields.due_date = due_date;
  if (is_confirmed !== undefined) fields.is_confirmed = is_confirmed;

  await plannedExpense.update(fields);
  return plannedExpense.get({ plain: true });
}

module.exports = { list, update };
